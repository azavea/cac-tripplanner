import ConfigParser

VPC_CIDR = '10.0.0.0/16'
ALLOW_ALL_CIDR = '0.0.0.0/0'

EC2_REGIONS = [
    'ap-northeast-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'eu-central-1',
    'eu-west-1',
    'sa-east-1',
    'us-east-1',
    'us-west-1',
    'us-west-2'
]

EC2_AVAILABILITY_ZONES = [
    'c',
]

EC2_INSTANCE_TYPES = [
    'c4.8xlarge',
    'c3.2xlarge',
    'cc1.4xlarge',
    'i2.xlarge',
    'i2.2xlarge',
    'i2.4xlarge',
    'i2.8xlarge',
    'm2.4xlarge',
    'm3.large',
    'm3.2xlarge',
    'r3.large',
    'r3.2xlarge'
]


def read_file(file_name):
    """Reads an entire file and returns it as a string

    Arguments
    :param file_name: A path to a file
    """
    with open(file_name, 'r') as f:
        return f.read()


def get_config(cac_config_path, profile):
    """Gets an AWS config Dict

    Arguments
    :param cac_config_path: Path to the config file
    :param profile: Config profile to read
    """
    cac_config = ConfigParser.ConfigParser()
    cac_config.optionxform = str
    cac_config.read(cac_config_path)
    return {k: v.strip('"').strip("'") for k, v in cac_config.items(profile)}
