"""Helper stuff to deal with packer"""

import os
import subprocess
import shutil

from boto import ec2

CANONICAL_ACCOUNT_ID = '099720109477'


class CacStackException(Exception):
    pass


def get_ubuntu_ami(region, creds):
    """Gets AMI ID for current release in region

    Args:
      region (str): AWS region id
      creds (Dict): Dictionary containing AWS credentials
    """

    conn = ec2.connect_to_region(region, **creds)
    amis = conn.get_all_images(owners=[CANONICAL_ACCOUNT_ID], filters={
        'name': 'ubuntu/images/hvm-ssd/ubuntu-trusty-14.04-amd64-server-*',
        'architecture': 'x86_64',
        'root-device-type': 'ebs',
        'virtualization-type': 'hvm',
    })

    amis = sorted(amis, key=lambda ami: ami.creationDate, reverse=True)

    if len(amis) == 0:
        raise CacStackException('Did not find any ubuntu AMIs to use')
    return amis[0].id


def run_packer(machine_type, region, creds, aws_config):
    """Runs packer command to build the desired AMI(s)

    Args:
      machine_type (str): Optional machine type string for passing in as the `-only` param
      region (str): AWS region id
      creds (Dict): Dictionary containing AWS credentials
    """

    # Remove examples subdirectory from all Azavea roles
    ansible_roles_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), '../ansible/roles')
    for role_path in os.listdir(ansible_roles_path):
        examples_path = os.path.join(ansible_roles_path, role_path, 'examples')

        if role_path.startswith('azavea') and os.path.isdir(examples_path):
            print('Removing {}'.format(examples_path))
            shutil.rmtree(examples_path)

    env = os.environ.copy()
    env['AWS_ACCESS_KEY_ID'] = creds['aws_access_key_id']
    env['AWS_SECRET_ACCESS_KEY'] = creds['aws_secret_access_key']
    env['AWS_SESSION_TOKEN'] = creds['aws_security_token']

    aws_ubuntu_ami = get_ubuntu_ami(region, aws_config)

    packer_template_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'cac.json')
    packer_command = ['packer', 'build',
                      '-var', 'aws_region={}'.format(region),
                      '-var', 'ubuntu_ami={}'.format(aws_ubuntu_ami)]

    # Create the specified machine type, or all of them if one is not specified
    if machine_type:
        packer_command.append('-only')
        packer_command.append(machine_type)

    packer_command.append(packer_template_path)

    print 'Running Packer Command: {}'.format(' '.join(packer_command))
    subprocess.check_call(packer_command, env=env)