"""Encapsulates management of CAC App stacks (Web + OTP)"""

from troposphere import (
    Parameter,
    Ref,
    Output,
    Tags,
    GetAtt,
    ec2,
    route53,
    Join
)

import troposphere.autoscaling as asg
import troposphere.elasticloadbalancing as elb
import troposphere.cloudwatch as cw

from utils.cfn import get_availability_zones
from utils.constants import (
    ALLOW_ALL_CIDR,
    EC2_INSTANCE_TYPES,
    VPC_CIDR,
    PAPERTRAIL_PORT,
    POSTGRES
)


from majorkirby import StackNode, MKInputError


class AppServerStack(StackNode):
    """
    Base AppServer stack for Cac
    """

    # Must override the following 3 constants in the inheriting classes
    HEALTH_ENDPOINT = None
    STACK_NAME_PREFIX = None
    INPUTS = None

    DEFAULTS = {
        'Tags': {},
        'StackColor': 'Blue',
        'StackType': 'Development'
    }

    ATTRIBUTES = {
        'StackType': 'StackType',
        'StackColor': 'StackColor'
    }

    def set_up_stack(self):
        """Sets up the stack"""
        if not self.INPUTS or not self.STACK_NAME_PREFIX or not self.HEALTH_ENDPOINT:
            raise MKInputError('Must define INPUTS, STACK_NAME_PREFIX, and HEALTH_ENDPOINT')

        super(AppServerStack, self).set_up_stack()

        tags = self.get_input('Tags').copy()
        self.add_description('{} App Server Stack for Cac'.format(self.STACK_NAME_PREFIX))

        assert isinstance(tags, dict), 'tags must be a dictionary'

        self.availability_zones = get_availability_zones()

        tags.update({'StackType': 'AppServer'})
        self.default_tags = tags

        self.app_server_instance_type_parameter = self.add_parameter(Parameter(
            'AppServerInstanceType', Type='String', Default='t2.medium',
            Description='NAT EC2 instance type',
            AllowedValues=EC2_INSTANCE_TYPES,
            ConstraintDescription='must be a valid EC2 instance type.'
        ), source='AppServerInstanceType')

        self.param_app_server_iam_profile = self.add_parameter(Parameter(
            'AppServerIAMProfile', Type='String',
            Description='IAM Profile for instances'
        ), source='AppServerIAMProfile')

        self.app_server_ami = self.add_parameter(Parameter(
            'AppServerAMI',
            Type='String',
            Description='{} Server EC2 AMI'.format(self.STACK_NAME_PREFIX)
        ), source='AppServerAMI')

        self.keyname_parameter = self.add_parameter(Parameter(
            'KeyName',
            Type='String',
            Default='cac',
            Description='Name of an existing EC2 key pair'
        ), source='KeyName')

        self.param_color = self.add_parameter(Parameter(
            'StackColor', Type='String',
            Description='Stack color', AllowedValues=['Blue', 'Green', 'Orange']),
            source='StackColor')

        self.param_stacktype = self.add_parameter(Parameter(
            'StackType', Type='String',
            Description='Stack type', AllowedValues=['Development', 'Staging',
                                                     'Production']),
            source='StackType')

        self.param_public_hosted_zone_name = self.add_parameter(Parameter(
            'PublicHostedZoneName', Type='String',
            Description='Public hosted zone name'),
            source='PublicHostedZoneName')

        self.param_vpc = self.add_parameter(Parameter(
            'VpcId', Type='String', Description='Name of an existing VPC'),
            source='VpcId')

        self.param_notification_arn = self.add_parameter(Parameter(
            'GlobalNotificationsARN', Type='String',
            Description='Physical resource ID on an AWS::SNS::Topic for '
                        'notifications'),
            source='GlobalNotificationsARN')

        self.param_ssl_certificate_arn = self.add_parameter(Parameter(
            'SSLCertificateARN', Type='String',
            Description='Physical resource ID on an AWS::IAM::ServerCertificate '
                        'for the application server load balancer'),
            source='SSLCertificateARN')

        self.param_public_subnets = self.add_parameter(Parameter(
            'PublicSubnets', Type='CommaDelimitedList',
            Description='A list of public subnets'),
            source='AppServerPublicSubnets')

        self.param_private_subnets = self.add_parameter(Parameter(
            'PrivateSubnets', Type='CommaDelimitedList',
            Description='A list of private subnets'),
            source='AppServerPrivateSubnets')

        self.param_bastion_security_group = self.add_parameter(Parameter(
            'BastionSecurityGroup', Type='String',
            Description='The ID of the bastion security group'),
            source='BastionSecurityGroup')

        self.param_database_security_group = self.add_parameter(Parameter(
            'DatabaseSecurityGroup', Type='String',
            Description='The ID of the database security group'),
            source='DatabaseSecurityGroup')

        self.param_nat_security_group = self.add_parameter(Parameter(
            'NATSecurityGroup', Type='String',
            Description='The ID of the NAT security group'
            ),
            source='NATSecurityGroup')

        self.param_min_size = self.add_parameter(Parameter(
            'ASGMinSize', Type='Number',
            Default='1',
            Description='Min size of ASG'),
            source='ASGMinSize')

        self.param_max_size = self.add_parameter(Parameter(
            'ASGMaxSize', Type='Number',
            Default='1',
            Description='Max size of ASG'),
            source='ASGMaxSize')

        self.param_desired_capacity = self.add_parameter(Parameter(
            'ASGDesiredCapacity', Type='Number',
            Default='1',
            Description='Desired capacity of ASG'),
            source='ASGDesiredCapacity')

        #
        # Security Group
        #
        app_server_load_balancer_security_group = self.add_resource(ec2.SecurityGroup(
            'sgAppServerLoadBalancer',
            GroupDescription='Enables access to app servers via a load balancer',
            VpcId=Ref(self.param_vpc),
            SecurityGroupIngress=[
                ec2.SecurityGroupRule(
                    IpProtocol='tcp', CidrIp=ALLOW_ALL_CIDR, FromPort=p, ToPort=p
                )
                for p in [80, 443]
            ],
            Tags=Tags(
                Name='sgAppServerLoadBalancer',
                Color=Ref(self.param_color)
            )
        ))

        app_server_security_group = self.add_resource(ec2.SecurityGroup(
            'sgAppServer', GroupDescription='Enables access to App Servers',
            VpcId=Ref(self.param_vpc),
            SecurityGroupIngress=[
                ec2.SecurityGroupRule(
                    IpProtocol='tcp', CidrIp=VPC_CIDR, FromPort=p, ToPort=p
                )
                for p in [22, 80, 443]
            ] + [
                ec2.SecurityGroupRule(
                    IpProtocol='tcp', SourceSecurityGroupId=Ref(sg),
                    FromPort=80, ToPort=80
                )
                for sg in [app_server_load_balancer_security_group]
            ] + [
                ec2.SecurityGroupRule(
                    IpProtocol='tcp', SourceSecurityGroupId=Ref(sg),
                    FromPort=443, ToPort=443
                )
                for sg in [app_server_load_balancer_security_group]
            ],
            SecurityGroupEgress=[
                ec2.SecurityGroupRule(
                    IpProtocol='tcp', CidrIp=ALLOW_ALL_CIDR, FromPort=p, ToPort=p
                )
                for p in [80, 443, PAPERTRAIL_PORT]
            ],
            Tags=Tags(
                Name='sgAppServer',
                Color=Ref(self.param_color)
            )
        ))

        # ELB to App Server
        self.add_resource(ec2.SecurityGroupEgress(
            'sgEgressELBtoAppHTTP',
            GroupId=Ref(app_server_load_balancer_security_group),
            DestinationSecurityGroupId=Ref(app_server_security_group),
            IpProtocol='tcp',
            FromPort=80,
            ToPort=80
        ))

        self.add_resource(ec2.SecurityGroupEgress(
            'sgEgressELBtoAppHTTPS',
            GroupId=Ref(app_server_load_balancer_security_group),
            DestinationSecurityGroupId=Ref(app_server_security_group),
            IpProtocol='tcp',
            FromPort=443,
            ToPort=443
        ))

        # Bastion to App Server, app server to db, app server to inet
        rules = [
            (self.param_bastion_security_group,
             app_server_security_group,
             [80, 443, 22]),
            (app_server_security_group,
             self.param_database_security_group,
             [POSTGRES]),
            (app_server_security_group,
             self.param_nat_security_group,
             [80, 443, 22, 587, PAPERTRAIL_PORT])
        ]
        for num, (srcsg, destsg, ports) in enumerate(rules):
            for port in ports:
                self.add_resource(ec2.SecurityGroupEgress(
                    'sgEgress{}p{}'.format(num, port),
                    GroupId=Ref(srcsg),
                    DestinationSecurityGroupId=Ref(destsg),
                    IpProtocol='tcp',
                    FromPort=port,
                    ToPort=port
                ))
                self.add_resource(ec2.SecurityGroupIngress(
                    'sgIngress{}p{}'.format(num, port),
                    GroupId=Ref(destsg),
                    SourceSecurityGroupId=Ref(srcsg),
                    IpProtocol='tcp',
                    FromPort=port,
                    ToPort=port
                ))

        #
        # ELB
        #
        app_server_load_balancer = self.add_resource(elb.LoadBalancer(
            'elbAppServer',
            ConnectionDrainingPolicy=elb.ConnectionDrainingPolicy(
                Enabled=True,
                Timeout=300
            ),
            CrossZone=True,
            SecurityGroups=[Ref(app_server_load_balancer_security_group)],
            Listeners=[
                elb.Listener(
                    LoadBalancerPort='80',
                    Protocol='HTTP',
                    InstancePort='80',
                    InstanceProtocol='HTTP'
                ),
                elb.Listener(
                    LoadBalancerPort='443',
                    Protocol='HTTPS',
                    InstancePort='443',
                    InstanceProtocol='HTTP',
                    SSLCertificateId=Ref(self.param_ssl_certificate_arn)
                )
            ],
            HealthCheck=elb.HealthCheck(
                Target=self.HEALTH_ENDPOINT,
                HealthyThreshold='3',
                UnhealthyThreshold='2',
                Interval='30',
                Timeout='5',
            ),
            Subnets=Ref(self.param_public_subnets),
            Tags=Tags(
                Name='elbAppServer',
                Color=Ref(self.param_color)
            )
        ))

        self.add_resource(cw.Alarm(
            'alarmAppServerBackend4xx',
            AlarmActions=[Ref(self.param_notification_arn)],
            Statistic='Sum',
            Period=300,
            Threshold='5',
            EvaluationPeriods=1,
            ComparisonOperator='GreaterThanThreshold',
            MetricName='HTTPCode_Backend_4XX',
            Namespace='AWS/ELB',
            Dimensions=[
                cw.MetricDimension(
                    'metricLoadBalancerName',
                    Name='LoadBalancerName',
                    Value=Ref(app_server_load_balancer)
                )
            ]
        ))

        self.add_resource(cw.Alarm(
            'alarmAppServerBackend5xx',
            AlarmActions=[Ref(self.param_notification_arn)],
            Statistic='Sum',
            Period=60,
            Threshold='0',
            EvaluationPeriods=1,
            ComparisonOperator='GreaterThanThreshold',
            MetricName='HTTPCode_Backend_5XX',
            Namespace='AWS/ELB',
            Dimensions=[
                cw.MetricDimension(
                    'metricLoadBalancerName',
                    Name='LoadBalancerName',
                    Value=Ref(app_server_load_balancer)
                )
            ]
        ))

        #
        # ASG
        #
        app_server_launch_config = self.add_resource(asg.LaunchConfiguration(
            'lcAppServer',
            ImageId=Ref(self.app_server_ami),
            IamInstanceProfile=Ref(self.param_app_server_iam_profile),
            InstanceType=Ref(self.app_server_instance_type_parameter),
            KeyName=Ref(self.keyname_parameter),
            SecurityGroups=[Ref(app_server_security_group)]
        ))

        autoscaling_group = self.add_resource(asg.AutoScalingGroup(
            'asgAppServer',
            AvailabilityZones=self.get_input('AppServerAvailabilityZones').split(','),
            Cooldown=300,
            DesiredCapacity=Ref(self.param_desired_capacity),
            HealthCheckGracePeriod=600,
            HealthCheckType='ELB',
            LaunchConfigurationName=Ref(app_server_launch_config),
            LoadBalancerNames=[Ref(app_server_load_balancer)],
            MaxSize=Ref(self.param_max_size),
            MinSize=Ref(self.param_min_size),
            NotificationConfigurations=[
                asg.NotificationConfigurations(
                    TopicARN=Ref(self.param_notification_arn),
                    NotificationTypes=[
                        asg.EC2_INSTANCE_LAUNCH,
                        asg.EC2_INSTANCE_LAUNCH_ERROR,
                        asg.EC2_INSTANCE_TERMINATE,
                        asg.EC2_INSTANCE_TERMINATE_ERROR
                    ]
                )
            ],
            VPCZoneIdentifier=Ref(self.param_private_subnets),
            Tags=[
                asg.Tag('Name', '{}Server'.format(self.STACK_NAME_PREFIX), True),
                asg.Tag('Color', Ref(self.param_color), True)
            ]
        ))

        # autoscaling policies
        autoscaling_policy_add = self.add_resource(asg.ScalingPolicy(
            'scalingPolicyAddAppServer',
            AdjustmentType='ChangeInCapacity',
            AutoScalingGroupName=Ref(autoscaling_group),
            Cooldown=600,
            ScalingAdjustment='1'
        ))

        autoscaling_policy_remove = self.add_resource(asg.ScalingPolicy(
            'scalingPolicyRemoveAppServer',
            AdjustmentType='ChangeInCapacity',
            AutoScalingGroupName=Ref(autoscaling_group),
            Cooldown=600,
            ScalingAdjustment='-1'
        ))

        if self.STACK_NAME_PREFIX == 'Otp':
            # trigger scale down if CPU avg usage < 10% for 3 consecutive 5 min periods
            self.add_resource(cw.Alarm(
                'alarmAppServerLowCPU',
                AlarmActions=[Ref(autoscaling_policy_remove)],
                Statistic='Average',
                Period=300,
                Threshold='10',
                EvaluationPeriods=3,
                ComparisonOperator='LessThanThreshold',
                MetricName='CPUUtilization',
                Namespace='AWS/EC2',
                Dimensions=[
                    cw.MetricDimension(
                        'metricAutoScalingGroupName',
                        Name='AutoScalingGroupName',
                        Value=Ref(autoscaling_group)
                    )
                ]
            ))

            # trigger scale up if CPU avg usage >= 30% for a 5 min period
            self.add_resource(cw.Alarm(
                'alarmAppServerHighCPU',
                AlarmActions=[Ref(self.param_notification_arn), Ref(autoscaling_policy_add)],
                Statistic='Average',
                Period=300,
                Threshold='30',
                EvaluationPeriods=1,
                ComparisonOperator='GreaterThanOrEqualToThreshold',
                MetricName='CPUUtilization',
                Namespace='AWS/EC2',
                Dimensions=[
                    cw.MetricDimension(
                        'metricAutoScalingGroupName',
                        Name='AutoScalingGroupName',
                        Value=Ref(autoscaling_group)
                    )
                ]
            ))
        else:
            # scale web servers based on network usage
            self.add_resource(cw.Alarm(
                'alarmAppServerLowNetworkUsage',
                AlarmActions=[Ref(autoscaling_policy_remove)],
                Statistic='Average',
                Period=300,
                Threshold='2000000',
                EvaluationPeriods=3,
                ComparisonOperator='LessThanThreshold',
                MetricName='NetworkOut',
                Namespace='AWS/EC2',
                Dimensions=[
                    cw.MetricDimension(
                        'metricAutoScalingGroupName',
                        Name='AutoScalingGroupName',
                        Value=Ref(autoscaling_group)
                    )
                ]
            ))

            self.add_resource(cw.Alarm(
                'alarmAppServerHighNetworkUsage',
                AlarmActions=[Ref(self.param_notification_arn), Ref(autoscaling_policy_add)],
                Statistic='Average',
                Period=300,
                Threshold='10000000',
                EvaluationPeriods=1,
                ComparisonOperator='GreaterThanOrEqualToThreshold',
                MetricName='NetworkOut',
                Namespace='AWS/EC2',
                Dimensions=[
                    cw.MetricDimension(
                        'metricAutoScalingGroupName',
                        Name='AutoScalingGroupName',
                        Value=Ref(autoscaling_group)
                    )
                ]
            ))

        #
        # DNS name
        #
        self.create_resource(route53.RecordSetType(
            'dnsName',
            Name=Join('.', [Ref(self.param_color),
                            Ref(self.param_stacktype),
                            self.STACK_NAME_PREFIX,
                            Ref(self.param_public_hosted_zone_name)]),
            Type='A',
            AliasTarget=route53.AliasTarget(GetAtt(app_server_load_balancer, 'CanonicalHostedZoneNameID'),
                                            GetAtt(app_server_load_balancer, 'DNSName')),
            HostedZoneName=Ref(self.param_public_hosted_zone_name)
        ))

        self.add_output([
            Output(
                '{}ServerLoadBalancerEndpoint'.format(self.STACK_NAME_PREFIX),
                Description='Application server endpoint',
                Value=GetAtt(app_server_load_balancer, 'DNSName')
            ),
            Output(
                '{}ServerLoadBalancerHostedZoneNameID'.format(self.STACK_NAME_PREFIX),
                Description='ID of canonical hosted zone name for ELB',
                Value=GetAtt(app_server_load_balancer, 'CanonicalHostedZoneNameID')
            )
        ])

# Base inputs used for both Web and Otp
# Must be extended with AppServerAMI
BASE_INPUTS = {
    'Tags': ['global:Tags'],
    'VpcId': ['global:VpcId', 'VPC:VpcId'],
    'AppServerInstanceType': ['global:AppServerInstanceType'],
    'AppServerIAMProfile': ['global:AppServerIAMProfile'],
    'KeyName': ['global:AppServerKeyName', 'global:KeyName'],
    'StackColor': ['global:StackColor'],
    'GlobalNotificationsARN': ['global:GlobalNotificationsARN'],
    'SSLCertificateARN': ['global:SSLCertificateARN'],
    'AppServerPublicSubnets': ['global:AppServerPublicSubnets',
                               'VPC:DefaultAppServerPublicSubnets'],
    'AppServerPrivateSubnets': ['global:AppServerPrivateSubnets',
                                'VPC:DefaultAppServerPrivateSubnets'],
    'AppServerAvailabilityZones': ['global:AppServerAvailabilityZones',
                                   'VPC:DefaultAppServerAvailabilityZones'],
    'BastionSecurityGroup': ['global:BastionSecurityGroup',
                             'VPC:BastionSecurityGroup'],
    'DatabaseSecurityGroup': ['global:DatabaseSecurityGroup',
                              'DataPlane:DatabaseSecurityGroup'],
    'NATSecurityGroup': ['global:NATSecurityGroup',
                         'VPC:NATSecurityGroup'],
    'PublicHostedZoneName': ['global:PublicHostedZoneName'],
    'ASGMinSize': ['global:ASGMinSize'],
    'ASGMaxSize': ['global:ASGMaxSize'],
    'ASGDesiredCapacity': ['global:ASGDesiredCapacity'],
    'StackType': ['global:StackType'],
    'StackColor': ['global:StackColor']
}


class OtpServerStack(AppServerStack):
    """
    OpenTripPlanner stack for Cac
    """
    HEALTH_ENDPOINT = 'HTTP:80/otp/'
    STACK_NAME_PREFIX = 'Otp'
    INPUTS = dict(BASE_INPUTS, **{'AppServerAMI': ['global:OtpServerAMI'],
                                  'AppServerInstanceType': ['global:OtpInstanceType']})


class WebServerStack(AppServerStack):
    """
    Web stack for Cac
    """
    HEALTH_ENDPOINT = 'HTTP:443/'
    STACK_NAME_PREFIX = 'Web'
    INPUTS = dict(BASE_INPUTS, **{'AppServerAMI': ['global:WebServerAMI']})
