"""Helper for setting up AWS MFA auth"""
import os

import boto


class AuthException(Exception):
    pass


BOTO_CONFIG_TEMPLATE = """
[default]
aws_access_key_id = {aws_access_key_id}
aws_secret_access_key = {aws_secret_access_key}
aws_security_token = {aws_security_token}
"""


def get_creds(aws_access_key_id, aws_secret_access_key, aws_role_arn):
    """Helper method that returns a new AWS config with temp credentials

    Args:
      aws_access_key_id (str): AWS access key id (public)
      aws_secret_access_key (str): AWS secret key (private)
    """
    aws_config = {'aws_access_key_id': aws_access_key_id,
                  "aws_secret_access_key": aws_secret_access_key}
    iam_conn = boto.connect_iam(**aws_config)
    sts_conn = boto.connect_sts(**aws_config)
    username = raw_input('Please provide AWS username: ')
    mfa_devices = (iam_conn.get_all_mfa_devices(username)
                   ['list_mfa_devices_response']
                   ['list_mfa_devices_result']
                   ['mfa_devices'])

    if len(mfa_devices) > 1:
        raise AuthException('Unable to handle a user with multiple MFA devices')

    if len(mfa_devices) == 0:
        raise AuthException('Must have MFA device to get temporary credentials')

    mfa_serial_number = mfa_devices[0]['serial_number']
    mfa_token = raw_input('Please enter your 6 digit MFA token: ')

    assumed_role = sts_conn.assume_role(
        role_arn=aws_role_arn,
        role_session_name='AssumeRoleSessionWithMFA',
        mfa_serial_number=mfa_serial_number,
        mfa_token=mfa_token
    )

    return dict(aws_access_key_id=assumed_role.credentials.access_key,
                aws_secret_access_key=assumed_role.credentials.secret_key,
                aws_security_token=assumed_role.credentials.session_token)


def write_creds(creds, force):
    """Write temporary credentials to file to be used by boto or other CLI tools

    Args:
      creds (Dict): Dictionary containing AWS credentials
      force (bool): whether or not to overwrite existing credentials files
    """
    aws_dir = os.path.expanduser('~/.aws')
    if not os.path.exists(aws_dir):
        os.mkdir(aws_dir)

    boto_config_path = os.path.join(aws_dir, 'credentials')
    if os.path.isfile(boto_config_path) and not force:
        raise AuthException('Must use --force option to replace existing boto config')

    with open(boto_config_path, 'wb') as fh:
        boto_config = BOTO_CONFIG_TEMPLATE.format(
            aws_access_key_id=creds['aws_access_key_id'],
            aws_secret_access_key=creds['aws_secret_access_key'],
            aws_security_token=creds['aws_security_token'])
        fh.write(boto_config)


def delete_creds():
    """Delete the credentials file if there is one"""
    cred_file = os.path.expanduser('~/.aws/credentials')
    if os.path.isfile(cred_file):
        os.remove(cred_file)
