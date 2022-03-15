#!/bin/bash

set -e

echo "Fetching otp url used by latest WebServer instance..."

WEBSERVER=$(AWS_PROFILE=gophillygo aws ec2 describe-instances \
    --filters 'Name=tag:Name,Values=WebServer' \
    --query 'Reservations[].Instances[].{ip:PrivateIpAddress,time:LaunchTime}' | \
    jq -r 'sort_by(.time) | reverse | .[0].ip')

#There is only one, but sort by latest in event of multiple instances
BASTION=$(AWS_PROFILE=gophillygo aws ec2 describe-instances \
    --filters 'Name=tag:Name,Values=BastionHost' \
    --query 'Reservations[].Instances[].{dns:PublicDnsName,time:LaunchTime}' | \
    jq -r 'sort_by(.time) | reverse | .[0].dns')

ssh -o ProxyCommand="ssh -i ~/.ssh/cac.pem -W %h:%p ubuntu@$BASTION" -i ~/.ssh/cac.pem ubuntu@$WEBSERVER /bin/bash << PRINTURL
    sed -n 14p /etc/cac_secrets
    exit
PRINTURL
