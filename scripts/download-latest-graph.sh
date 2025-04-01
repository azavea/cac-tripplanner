#!/bin/bash

set -e

graph_path="otp_data/Graph.obj"

if [[ ! -f "$graph_path" ]] || [[ "$*" == *"force"* ]]; then
    echo "Pulling latest Graph.obj from S3..."
    aws --profile=gophillygo s3 cp "s3://cleanair-otp-data/Graph.obj" "$graph_path"
else
    echo "Built graph already in otp_data directory, skip pulling latest from S3"
fi
