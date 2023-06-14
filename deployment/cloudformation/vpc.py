"""Encapsulates management of Cac VPC stack"""

from troposphere import (
    Parameter,
    Ref,
    Output,
    Tags,
    ec2,
    Join
)

from .utils.cfn import get_availability_zones
from .utils.constants import (
    ALLOW_ALL_CIDR,
    EC2_INSTANCE_TYPES,
    GRAPHITE_PORT,
    HTTP,
    HTTPS,
    KIBANA_PORT,
    PAPERTRAIL_PORT,
    SSH,
    VPC_CIDR
)

from majorkirby import StackNode


def subnet_cidr_block():
    """Generator to generate unique cidr block subnets"""
    current = 0
    high = 255
    while current <= high:
        yield '10.0.%s.0/24' % current
        current += 1

cidr_generator = subnet_cidr_block()


class VPC(StackNode):
    """VPC Template to be used in AWS environment - creates a CloudFormation template

    This class handles the creation of a VPC CloudFormation template. The following
    resources are created in this template:
      - 1 _public_ subnet per availability zone in a region
      - 1 _private_ subnet per availability zone in a region
      - Necessary route tables, routes for public subnets
      - Creates routes for the private subnets to NAT instances

    Note:
      NAT instances will only be created for a given set of availability zones
    because it is wasteful to launch NAT instances when those instances are not going
    to be used by private subnets because they are going to be used and held in reserve.

    Attributes:
      PUBLIC_SUBNETS (list of Ec2.Subnet): list of public subnets, used in constructing outputs for VPC
      PRIVATE_SUBNETS (list of Ec2.Subnet): list of private subnets, used in constructing outpus for VPC
    """

    INPUTS = {'Tags': ['global:Tags'],
              'NATInstanceAMI': ['global:NATInstanceAMI'],
              'NATAvailabilityZones': ['global:NATAvailabilityZones'],
              'OfficeCidr': ['global:OfficeCidr'],
              'BastionHostAMI': ['global:BastionHostAMI'],
              'StackType': ['global:StackType']
              }

    DEFAULTS = {'Tags': {},
                'NATInstanceAMI': 'ami-184dc970',  # amzn-ami-vpc-nat-hvm-2014.09.1.x86_64-gp2
                'BastionHostAMI': 'ami-6889d200',  # ubuntu-trusty-14.04-amd64-server-20150305
                'NATAvailabilityZones': ['us-east-1b', 'us-east-1d'],
                'OfficeCidr': '0.0.0.0',  # must supply CIDR in order to access bastion via SSH
                'StackType': 'Development'
                }

    ATTRIBUTES = {'StackType': 'StackType'}

    PUBLIC_SUBNETS = []
    PRIVATE_SUBNETS = []

    _NAT_SECURITY_GROUP_CACHE = None

    def set_up_stack(self):
        """Sets up the stack"""
        self.set_version()

        """Creates a VPC object. See Class docstring for description of class

        Args:
          nat_availability_zone_names (list of str): availability zone names used to restrict
            which availability zones NAT instances are created in. This should match what set of
            availability zones that instances actually get launched in.
          tags (dict): Arbitrary tags to add to all resources that accept tags
        """
        tags = self.get_input('Tags').copy()
        self.set_description('VPC Stack for Cac')

        assert isinstance(tags, dict), 'tags must be a dictionary'

        self.availability_zones = get_availability_zones()

        tags.update({'StackType': 'VPC'})
        self.default_tags = tags

        self.nat_instance_type_parameter = self.add_parameter(Parameter(
            'NATInstanceType', Type='String', Default='t2.micro',
            Description='NAT EC2 instance type',
            AllowedValues=EC2_INSTANCE_TYPES,
            ConstraintDescription='must be a valid EC2 instance type.'
        ))

        self.nat_instance_ami_parameter = self.add_parameter(Parameter(
            'NATInstanceAMI', Type='String',
            Description='NAT EC2 Instance AMI'
        ), 'NATInstanceAMI')

        self.office_cidr_parameter = self.add_parameter(Parameter(
            'OfficeCidr', Type='String',
            Description='CIDR of office for allowing SSH access'
        ), 'OfficeCidr')

        self.keyname_parameter = self.add_parameter(Parameter(
            'KeyName', Type='String', Default='cac', Description='Name of an existing EC2 key pair'
        ))

        self.bastion_instance_type_parameter = self.add_parameter(Parameter(
            'BastionInstanceType', Type='String', Default='t2.medium',
            Description='Bastion EC2 instance type',
            AllowedValues=EC2_INSTANCE_TYPES,
            ConstraintDescription='must be a valid EC2 instance type.'
        ))

        self.bastion_host_ami_parameter = self.add_parameter(Parameter(
            'BastionHostAMI', Type='String', Description='Bastion host AMI'
        ), 'BastionHostAMI')

        self.create_vpc()

        # The outputs below provide reasonable defaults but they are meant to
        # be overridden using a global config option if necessary.
        self.add_output(Output('DefaultAppServerAvailabilityZones',
                        Value=','.join(self.default_app_server_azs)))
        self.add_output(Output('DefaultAppServerPrivateSubnets',
                               Description='List of subnet ids for App Servers',
                               Value=Join(',', list(map(Ref, self.default_app_server_private_subnets)))))
        self.add_output(Output('DefaultAppServerPublicSubnets',
                               Description='List of Subnet Ids for App servers',
                               Value=Join(',', list(map(Ref, self.default_app_server_public_subnets)))))

    def create_vpc(self):
        """Creates a VPC template and returns the JSON string for that CloudFormation Template

        Returns:
          str: JSON string for CloudFormation that can be used to launch the CloudFormation stack
        """
        self.vpc = self.create_resource(ec2.VPC(
            'CacVPC',
            CidrBlock=VPC_CIDR,
            EnableDnsSupport=True,
            EnableDnsHostnames=True,
            Tags=self.get_tags()
        ), output='VpcId')

        public_route_table = self.create_routing_resources()
        self.create_subnets(public_route_table)
        self.create_bastion()

    def create_routing_resources(self):
        """Create VPC routing resource

        Handles the creation of VPC resources that need to be used throughout
        the stack and include the following:
         - internet gateway
         - vpc gateway attachment
         - public route table
         - public route
        """
        gateway = self.create_resource(
            ec2.InternetGateway(
                'InternetGateway',
                Tags=self.get_tags()
            )
        )

        gateway_attachment = self.create_resource(
            ec2.VPCGatewayAttachment(
                'VPCGatewayAttachment',
                VpcId=Ref(self.vpc),
                InternetGatewayId=Ref(gateway)
            )
        )

        public_route_table = self.create_resource(
            ec2.RouteTable(
                'PublicRouteTable',
                VpcId=Ref(self.vpc))
        )

        self.create_resource(
            ec2.Route(
                'PublicRoute',
                RouteTableId=Ref(public_route_table),
                DestinationCidrBlock=ALLOW_ALL_CIDR,
                DependsOn=gateway_attachment.title,
                GatewayId=Ref(gateway)
            )
        )

        return public_route_table

    def create_subnets(self, public_route_table):
        """Create one public and one private subnet for each availability zone

        Args:
          public_route_table (Ec2.RouteTable): routing table to attach public subnets to

        Note:
          NAT instances will be attached to private subnets, but only for the availabilty
          zones specified during the VPC object instantiation. This should match up to
          where web workers are launched since the other subnets will not be able to access
          the internet.
        """
        self.default_app_server_azs = []
        self.default_app_server_private_subnets = []
        self.default_app_server_public_subnets = []

        for num, availability_zone in enumerate(self.availability_zones):
            public_subnet_name = '{}PublicSubnet'.format(availability_zone.cfn_name)
            public_subnet = self.create_resource(ec2.Subnet(
                public_subnet_name,
                VpcId=Ref(self.vpc),
                CidrBlock=next(cidr_generator),
                AvailabilityZone=availability_zone.name,
                Tags=self.get_tags(Name=public_subnet_name)
            ), output=public_subnet_name)

            self.create_resource(ec2.SubnetRouteTableAssociation(
                '{}PublicRouteTableAssociation'.format(public_subnet.title),
                SubnetId=Ref(public_subnet),
                RouteTableId=Ref(public_route_table)
            ))

            private_subnet_name = '{}PrivateSubnet'.format(availability_zone.cfn_name)
            private_subnet = self.create_resource(ec2.Subnet(
                private_subnet_name,
                VpcId=Ref(self.vpc),
                CidrBlock=next(cidr_generator),
                AvailabilityZone=availability_zone.name,
                Tags=self.get_tags(Name=private_subnet_name)
                ), output=private_subnet_name)

            private_route_table_name = '{}PrivateRouteTable'.format(availability_zone.cfn_name)
            private_route_table = self.create_resource(ec2.RouteTable(
                private_route_table_name,
                VpcId=Ref(self.vpc),
                Tags=self.get_tags(Name=private_route_table_name)
            ))

            self.create_resource(ec2.SubnetRouteTableAssociation(
                '{}PrivateSubnetRouteTableAssociation'.format(private_subnet.title),
                SubnetId=Ref(private_subnet),
                RouteTableId=Ref(private_route_table)
            ))

            self.PUBLIC_SUBNETS.append(public_subnet)
            self.PRIVATE_SUBNETS.append(private_subnet)

            if availability_zone.name in self.get_input('NATAvailabilityZones'):
                self.create_nat(availability_zone, public_subnet, private_route_table)
                self.default_app_server_azs.append(availability_zone.name)
                self.default_app_server_private_subnets.append(private_subnet)
                self.default_app_server_public_subnets.append(public_subnet)

    def create_nat(self, availability_zone, public_subnet, private_route_table):
        """Create a NAT instance and attach it to a private subnet with a private route

        Args:
          availabilty_zone (AvailabilityZone): where to place the NAT device
          public_subnet (ec2.Subnet): subnet to place the NAT device
          private_route_table (ec2.RouteTable): RouteTable to attach NAT device
        """
        nat_device_name = '{}NATDevice'.format(availability_zone.cfn_name)
        nat_device = self.create_resource(ec2.Instance(
            nat_device_name,
            InstanceType=Ref(self.nat_instance_type_parameter),
            KeyName=Ref(self.keyname_parameter),
            SourceDestCheck=False,
            ImageId=Ref(self.nat_instance_ami_parameter),
            NetworkInterfaces=[
                ec2.NetworkInterfaceProperty(
                    Description='ENI for NATDevice',
                    GroupSet=[Ref(self.nat_security_group)],
                    SubnetId=Ref(public_subnet),
                    AssociatePublicIpAddress=True,
                    DeviceIndex=0,
                    DeleteOnTermination=True,
                )
            ],
            Tags=self.get_tags(Name=nat_device_name)
        ))

        self.create_resource(ec2.Route(
            '{}PrivateRoute'.format(availability_zone.cfn_name),
            RouteTableId=Ref(private_route_table),
            DestinationCidrBlock=ALLOW_ALL_CIDR,
            InstanceId=Ref(nat_device))
        )

    def create_bastion(self):
        """Create Bastion host and security group

        Creates a bastion instance and security group to allow access from
        the office for SSH and monitoring UIs (note: no monitoring UIs yet).

        Note:
          Explicit security group egress/ingress rules must be allowed after security
          groups for the database, web, and batch workers are added
        """
        bastion_security_group = self.create_resource(ec2.SecurityGroup(
            'sgBastion', GroupDescription='Enables access to the BastionHost',
            VpcId=Ref(self.vpc),
            SecurityGroupIngress=[
                ec2.SecurityGroupRule(IpProtocol='tcp', CidrIp=Ref(self.office_cidr_parameter),
                                      FromPort=p, ToPort=p)
                for p in [SSH, KIBANA_PORT, GRAPHITE_PORT]
            ],
            Tags=self.get_tags(Name='sgBastion')
        ), output='BastionSecurityGroup')

        self.add_resource(ec2.Instance(
            'BastionHost',
            BlockDeviceMappings=[
                {
                    "DeviceName": "/dev/sda1",
                    "Ebs": {
                        "VolumeType": "gp2",
                        "VolumeSize": "256"
                    }
                }
            ],
            InstanceType=Ref(self.bastion_instance_type_parameter),
            KeyName=Ref(self.keyname_parameter),
            ImageId=Ref(self.bastion_host_ami_parameter),
            NetworkInterfaces=[
                ec2.NetworkInterfaceProperty(
                    Description='ENI for BastionHost',
                    GroupSet=[Ref(bastion_security_group)],
                    SubnetId=Ref(self.PUBLIC_SUBNETS[0]),
                    AssociatePublicIpAddress=True,
                    DeviceIndex=0,
                    DeleteOnTermination=True
                )
            ],
            Tags=self.get_tags(Name='BastionHost')
        ))

        # So that stacks built on top of this one can allow access from the
        # Bastion

    @property
    def nat_security_group(self):
        """NAT security group to allow access to internet

        NOTE:
          After creating the web and database stacks, if internet access is
          required from those stacks, it will be necessary to add ingress rules
          with those security groups
        """
        if self._NAT_SECURITY_GROUP_CACHE:
            return self._NAT_SECURITY_GROUP_CACHE
        else:
            self._NAT_SECURITY_GROUP_CACHE = self.create_resource(ec2.SecurityGroup(
                'sgNAT', GroupDescription='Enables access to the NAT devices',
                VpcId=Ref(self.vpc),
                SecurityGroupEgress=[
                    ec2.SecurityGroupRule(
                        IpProtocol='tcp', CidrIp=ALLOW_ALL_CIDR, FromPort=port, ToPort=port
                    ) for port in [HTTP, HTTPS, PAPERTRAIL_PORT]
                ],
                Tags=self.get_tags()), 'NATSecurityGroup'
            )
            return self._NAT_SECURITY_GROUP_CACHE

    def create_resource(self, resource, output=None):
        """Helper method to attach resource to template and return it

        This helper method is used when adding _any_ CloudFormation resource
        to the template. It abstracts out the creation of the resource, adding
        it to the template, and optionally adding it to the outputs as well

        Args:
          resource: Troposphere resource to create
          output (str): name of output to return this value as
        """
        resource = self.add_resource(resource)

        if output:
            cloudformation_output = Output(
                output,
                Value=Ref(resource)
            )

            self.add_output(cloudformation_output)

        return resource

    def get_tags(self, **kwargs):
        """Helper method to return Troposphere tags + default tags

        Args:
          **kwargs: arbitrary keyword arguments to be used as tags

        Returns:
          Tags
        """
        kwargs.update(self.default_tags)
        return Tags(**kwargs)
