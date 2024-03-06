from majorkirby import CustomActionNode

import json
import boto3
import uuid

class R53PrivateHostedZone(CustomActionNode):
    """Represents a Route53 private hosted zone"""
    INPUTS = {'VpcId': ['global:VpcId', 'VPC:VpcId'],
              'PrivateHostedZoneName': ['global:PrivateHostedZoneName'],
              'StackType': ['global:StackType']}

    DEFAULTS = {'StackType': 'Development'}

    ATTRIBUTES = {'StackType': 'StackType'}

    REGION = 'us-east-1'

    def action(self):
        """Creates the zone"""
        client = boto3.client('route53', region_name=self.REGION)
        comment = json.dumps(self.get_raw_tags())

        hosted_zones = client.list_hosted_zones()

        for hosted_zone in hosted_zones['HostedZones']:
            if ('Comment' in hosted_zone['Config'] and
                    hosted_zone['Config']['Comment'] == comment):
                self.stack_outputs = {'PrivateHostedZoneId': hosted_zone['Id'].split('/')[-1]}
                return
            
        vpc_config = {
            'VPCRegion': self.REGION,
            'VPCId': self.get_input("VpcId")
        }
        hosted_zone_config = {
            'Comment': comment,
            'PrivateZone': True
        }

        hosted_zone = client.create_hosted_zone(
            Name=self.get_input("PrivateHostedZoneName"),
            CallerReference=str(uuid.uuid4()),
            HostedZoneConfig=hosted_zone_config,
            VPC=vpc_config,
        )
        hosted_zone_id = hosted_zone['CreateHostedZoneResponse']['HostedZone']['Id']
        self.stack_outputs = {'PrivateHostedZoneId': hosted_zone_id.split('/')[-1]}

