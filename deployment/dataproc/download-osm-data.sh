#!/bin/bash

declare -a STATES=("pennsylvania" "new-jersey" "delaware")

for STATE in "${STATES[@]}"; do
    echo "downloading OSM data for ${STATE}..."
    curl https://download.geofabrik.de/north-america/us/${STATE}-latest.osm.pbf -o ${STATE}.pbf
done
