#!/bin/bash

declare -a STATES=("pennsylvania" "new-jersey" "delaware")

for STATE in "${STATES[@]}"; do
    echo "Fetching latest OSM data timestamp for ${STATE}..."
    # Fetch the state.txt file to get the latest timestamp and extract date
    TIMESTAMP=$(curl -s "https://download.geofabrik.de/north-america/us/${STATE}-updates/state.txt" | grep "timestamp=" | awk -F'[=T]' '{print $2}')
    if [ -z "$TIMESTAMP" ]; then
        echo "Could not find a timestamp for ${STATE}. Skipping."
        continue
    fi

    # Format the timestamp to YYYYMMDD for url
    FORMATTED_TIMESTAMP=$(echo "$TIMESTAMP" | awk -F'-' '{printf("%s%s%s\n", substr($1,3,2), $2, $3)}')

    echo "downloading OSM data for ${STATE}..."
    curl https://download.geofabrik.de/north-america/us/${STATE}-${FORMATTED_TIMESTAMP}.osm.pbf -o ${STATE}.pbf
done
