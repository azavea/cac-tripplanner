"""Storage for constants that need to be referenced in templates"""

################
## AWS Resources
################
EC2_INSTANCE_TYPES = [
    't1.micro',
    't2.micro',
    't2.medium',
    'm3.medium',
    't2.small'
]

RDS_INSTANCE_TYPES = [
    'db.t1.micro',
    'db.m1.small',
    'db.m3.medium',
    'db.m3.large',
    'db.m3.xlarge',
    'db.m3.2xlarge'
]

##################
## IPs and Subnets
##################
ALLOW_ALL_CIDR = '0.0.0.0/0'
VPC_CIDR = '10.0.0.0/16'

SSH = 22
HTTP = 80
HTTPS = 443
POSTGRES = 5432
KIBANA_PORT = 5000
GRAPHITE_PORT = 5601

############################
## Monitoring instance ports
############################
REDIS = 6379
RELP = 20514
GRAPHITE_PUBL = 2003
GRAPHITE_HTTP = 8080
STATSITE_PUBL = 8125
ELASTICSEARCH_HTTP = 9200
ELASTICSEARCH_PUBL = 9300
