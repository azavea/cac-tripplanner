"""Handles template generation for Cac Data Plane stack"""

from troposphere import (
    Parameter,
    Ref,
    Output,
    Tags,
    GetAtt,
    ec2,
    rds,
    route53
)

from .utils.constants import RDS_INSTANCE_TYPES

from majorkirby import StackNode


class BaseFactory(object):
    """Base class for factories to put things into Troposphere templates

    In subclasses, ensure that self.parameters, self.resources, and self.outputs are
    populated by __init__(). The insert_[parameters|resources|outputs] functions may
    also be overridden if necessary.
    """
    def __init__(self):
        self.parameters = []
        self.resources = []
        self.outputs = []

    def insert_parameters(self, template):
        """Add parameters to template and return a list of inserted params

        :param template: troposphere.Template object to insert params into.
        :return: List of troposphere.Parameter objects that were inserted."""
        inserted = []
        for param in self.parameters:
            # Skip parameters that already exist in the template; multiple
            # factories may rely on the same parameter.
            if param.title in template.parameters:
                continue
            inserted.append(template.add_parameter(param))
        return inserted

    def insert_resources(self, template):
        """Add resources to template and return a list of inserted params

        :param template: troposphere.Template object to insert resources into
        :return: List of troposphere.Resource objects that were inserted."""
        # This will raise an exception on duplicate keys, unlike with
        # parameters; two factories shouldn't attempt to create the same
        # resources.
        return [template.add_resource(rsrc) for rsrc in self.resources]

    def insert_outputs(self, template):
        """Add outputs to template and return a list of inserted outputs
        :param template: troposphere.Template object to insert Outputs into
        :return: List of troposphere.Output objects that were inserted."""
        # This will raise an exception on duplicate keys, unlike with
        # parameters
        return [template.add_output(output) for output in self.outputs]

    def populate_template(self, template):
        """Convenience method to fully populate a template from this factory.
        :param template: troposphere.Template object to populate
        :return: Template with populated parameters, resources, and outputs"""
        self.insert_parameters(template)
        self.insert_resources(template)
        self.insert_outputs(template)
        return template  # Not strictly necessary but allows nesting functions


class RDSFactory(BaseFactory):
    """Can add a Cac RDS instance to a Template"""
    def __init__(self, tags=dict()):
        super(RDSFactory, self).__init__()
        self.tags = tags
        # Largely copied from
        # https://github.com/cloudtools/troposphere/blob/master/examples/RDS_VPC.py

        # Each parameter is followed by the resources which depend on it.
        # VPC and security groups
        vpcid = Parameter(
            'VpcId',
            Type='String',
            Description='Id of existing VPC'
        )
        private_hosted_zone_id = Parameter(
            'PrivateHostedZoneId',
            Type='String',
            Description='Private hosted zone id'
        )
        db_security_group = ec2.SecurityGroup(
            'sgDatabase',
            GroupDescription='Security group for RDS DB Instance.',
            VpcId=Ref(vpcid),
            Tags=Tags(Name='Database', **self.tags)
        )

        # Subnets
        subnets = Parameter(
            'AppServerSubnets',
            Type='CommaDelimitedList',
            Description='List of SubnetIds spanning at least two AZs in VPC'
        )
        subnet_group = rds.DBSubnetGroup(
            'CacDbSubnetGroup',
            DBSubnetGroupDescription='Subnets available for Cac RDS instance',
            SubnetIds=Ref(subnets),
            Tags=Tags(Name='RDSSubnetGroup', **self.tags)
        )

        # Database
        db_name = Parameter(
            'DbName',
            Description='Name of the database to be created',
            Type='String',
            MinLength='5',
            MaxLength='63',
            AllowedPattern='[a-zA-Z_][a-zA-Z0-9_]*',
            ConstraintDescription='Name must begin with a letter and contain only alphanumerics'
        )
        db_user = Parameter(
            'DbUser',
            NoEcho=True,
            Description='Database admin user account',
            Type='String',
            MinLength='5',
            MaxLength='16',
            AllowedPattern='[a-zA-Z][a-zA-Z0-9]*',
            ConstraintDescription='Name must begin with a letter and contain only alphanumerics'
        )
        db_password = Parameter(
            'DbPassword',
            NoEcho=True,
            Description='Database admin account password',
            Type='String',
            MinLength='8',
        )
        db_instance_class = Parameter(
            'DbInstanceClass',
            Default='db.m3.medium',
            Description='Database instance class',
            Type='String',
            AllowedValues=RDS_INSTANCE_TYPES
        )
        db_storage = Parameter(
            'DbStorage',
            Description='Available database storage (GB)',
            Default='100',
            Type='Number',
            MaxValue='1024',
            ConstraintDescription='Storage space must be less than 1024GB',
        )
        db_dns_name = Parameter(
            'DbDNSName',
            Type='String',
            Description='Private DNS name for database'
        )

        database = rds.DBInstance(
            'CacDb',
            DBName=Ref(db_name),
            AllocatedStorage=Ref(db_storage),
            DBInstanceClass=Ref(db_instance_class),
            Engine='postgres',
            EngineVersion='9.4',
            MasterUsername=Ref(db_user),
            MasterUserPassword=Ref(db_password),
            DBSubnetGroupName=Ref(subnet_group),
            VPCSecurityGroups=[Ref(db_security_group)],
            MultiAZ=True,
            Tags=Tags(Name='CacDB', **self.tags)
        )

        db_dns_record = route53.RecordSetType(
            'rsDatabase',
            Name=Ref(db_dns_name),
            ResourceRecords=[GetAtt('CacDb', 'Endpoint.Address')],
            TTL=600,
            Type='CNAME',
            HostedZoneId=Ref(private_hosted_zone_id),
        )

        # Outputs
        rds_endpoint = Output(
            'CacDbEndpoint',
            Description='Endpoint to which Postgres clients should connect',
            Value=GetAtt('CacDb', 'Endpoint.Address')
        )

        database_name = Output(
            'CacDbName',
            Description='Name of database created on Cac RDS instance',
            Value=Ref(db_name)
        )

        db_sg = Output(
            'DatabaseSecurityGroup',
            Description='Security Group of Database',
            Value=GetAtt('sgDatabase', 'GroupId')
        )

        self.parameters = [vpcid, private_hosted_zone_id, subnets, db_name,
                           db_user, db_password, db_instance_class,
                           db_storage, db_dns_name]

        self.resources = [db_security_group, subnet_group, database,
                          db_dns_record]

        self.outputs = [rds_endpoint, database_name, db_sg]


class DataPlaneGenerator(StackNode):
    """Create a template for the Cac data plane"""
    INPUTS = {'Tags': ['global:Tags'],
              'BastionSecurityGroup': ['global:BastionSecurityGroup', 'VPC:BastionSecurityGroup'],
              'VpcId': ['global:VpcId', 'VPC:VpcId'],
              'AppServerSubnets': ['global:AppServerSubnets', 'VPC:DefaultAppServerPrivateSubnets'],
              'DbName': ['global:DbName'],
              'DbUser': ['global:DbUser'],
              'DbPassword': ['global:DbPassword'],
              'DbInstanceClass': ['global:DbInstanceClass'],
              'DbStorage': ['global:DbStorage'],
              'PrivateHostedZoneId': ['global:PrivateHostedZoneId',
                                      'R53PrivateHostedZone:PrivateHostedZoneId'],
              'DbDNSName': ['global:DbDNSName'],
              'StackType': ['global:StackType']
              }

    DEFAULTS = {'Tags': {},
                'DbName': 'cac',
                'DbStorage': 150,
                'DbInstanceClass': 'db.m3.medium',
                'StackType': 'Development'
                }

    NAME = 'DataPlane'

    ATTRIBUTES = {'StackType': 'StackType'}

    def set_up_stack(self):
        """Sets up the stack"""
        self.set_version()
        self.set_description('Data Plane Stack for Cac')
        self.rds_stack = RDSFactory()
        self.rds_stack.populate_template(self)
        for key in self.parameters:
            self.input_wiring[key] = key
