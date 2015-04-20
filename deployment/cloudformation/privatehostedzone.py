from boto import route53

from majorkirby import CustomActionNode

import json


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
        conn = route53.connect_to_region(self.REGION)
        comment = json.dumps(self.get_raw_tags())

        hosted_zones = conn.get_all_hosted_zones()

        for hosted_zone in hosted_zones['ListHostedZonesResponse']['HostedZones']:
            if ('Comment' in hosted_zone['Config'] and
                    hosted_zone['Config']['Comment'] == comment):
                self.stack_outputs = {'PrivateHostedZoneId': hosted_zone['Id'].split('/')[-1]}
                return

        hosted_zone = conn.create_hosted_zone(self.get_input('PrivateHostedZoneName'),
                                              comment=comment,
                                              private_zone=True,
                                              vpc_id=self.get_input('VpcId'),
                                              vpc_region=self.REGION)
        hosted_zone_id = hosted_zone['CreateHostedZoneResponse']['HostedZone']['Id']
        self.stack_outputs = {'PrivateHostedZoneId': hosted_zone_id.split('/')[-1]}
