#!/bin/bash
#
# Download and install Boundary executable for logging.
# Based on Boundary-provided installer command.
#

set -e
set -o errexit

cd /opt
curl -fsS -d '{"token":"$1"}' -H 'Content-Type: application/json' https://meter.boundary.com/setup_meter > setup_meter.sh
chmod +x setup_meter.sh
./setup_meter.sh -i "$1" -s --enable-server-metrics -t app,cac
