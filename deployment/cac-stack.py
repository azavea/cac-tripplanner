#!/usr/bin/env python3

"""Commands for building AMIs and setting up CAC TripPlanner stacks on AWS"""
import argparse
import os

from cloudformation.stacks import build_stacks
from cloudformation.template_utils import get_config
from packer.cac_packer import run_packer


file_dir = os.path.dirname(os.path.realpath(__file__))


def launch_stacks(cac_config, stack_type, stack_color, **kwargs):
    """Launches the specified stacks

    Args:
      cac_config (Dict): Dictionary of AWS parameter values
      stack_type (str): Type of environment (dev, prod, test)
      stack_color (str): Color of environment (blue, green)
    """

    build_stacks(cac_config, stack_type, stack_color)


def create_ami(machine_type, aws_region, aws_profile, **kwargs):
    """Creates the specified AMI(s)

    Args:
      machine_type (str): Optional type of AMI to build (all are built if unspecified)
      aws_region (str): AWS region id
      aws_profile (str): AWS profile name
    """
    run_packer(machine_type, aws_region, aws_profile)


def main():
    """Parse args and run desired commands"""
    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument('--aws-region', default='us-east-1',
                               help='AWS region -- defaults to us-east-1')
    common_parser.add_argument('--aws-profile', default=os.environ.get('AWS_PROFILE', 'gophillygo'),
                               help='AWS profile')
    common_parser.add_argument('--cac-config-path', default=os.path.join(file_dir, 'default.yaml'),
                               help='Path to CAC stack config')
    common_parser.add_argument('--cac-profile', default='default',
                               help='CAC stack profile to use for launching stacks')


    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(title='CAC TripPlanner Stack Commands')

    # Launch CAC TripPlanner Stack
    cac_stacks = subparsers.add_parser('launch-stacks', help='Launch CAC TripPlanner Stack',
                                       parents=[common_parser])
    cac_stacks.add_argument('--stack-type', type=str, required=True,
                            choices=['dev', 'staging', 'prod'],
                            default=None,
                            help='One of "dev", "staging", "prod"')
    cac_stacks.add_argument('--stack-color', type=str, required=True,
                            choices=['green', 'blue', 'orange'],
                            default=None,
                            help='One of "green", "blue", "orange"')
    cac_stacks.set_defaults(func=launch_stacks)

    # AMI Management
    cac_ami = subparsers.add_parser('create-ami', help='Create AMI for CAC TripPlanner Stack',
                                    parents=[common_parser])
    cac_ami.add_argument('--machine-type', type=str, required=False,
                         choices=['app', 'bastion', 'otp'],
                         default=None,
                         help='Optional machine type. One of "app", "bastion", "otp"')
    cac_ami.set_defaults(func=create_ami)

    # Parse and run
    args = parser.parse_args()
    cac_config = get_config(args.cac_config_path, args.cac_profile)
    args.func(cac_config=cac_config, **vars(args))

if __name__ == '__main__':
    main()
