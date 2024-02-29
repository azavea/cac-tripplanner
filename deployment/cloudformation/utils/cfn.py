"""Helper functions and classes for dealing with cloudformation"""
import boto3


class AvailabilityZone(object):
    """Helper class that represents an availability zone

    We often only want 2 things from an AZ - a slug and name.
    This class keeps those in one location.
    """

    def __init__(self, availability_zone):
        """Creates an AvailabilityZoneHelper object

        Args:
        availability_zone (AvailabilityZone): boto object
        """
        self.availability_zone = availability_zone

    @property
    def cfn_name(self):
        """
        Utility method to return a string appropriate for CloudFormation
        name of a resource (e.g. UsEast1a)
        """
        return self.availability_zone['ZoneName'].title().replace('-', '')

    @property
    def name(self):
        """Utility function to return the name of an availability zone (e.g. us-east-1a)"""
        return self.availability_zone['ZoneName']


def get_availability_zones():
    """Helper function that returns availability zones for a region

    Returns:
      (list of AvailabilityZone): List of availability zones for a given EC2 region
    """
    client = boto3.client('ec2', region_name='us-east-1')
    return  [AvailabilityZone(az) for az in client.describe_availability_zones()['AvailabilityZones']]
