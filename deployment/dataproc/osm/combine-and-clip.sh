#!/bin/bash

BOUNDS=-76.209582,38.441753,-74.243725,40.725449

declare -a STATES=("pennsylvania" "new-jersey" "delaware")

for STATE in "${STATES[@]}"; do
    echo "extracting OSM data for the region served by CAC for ${STATE}..."
    osmconvert ${STATE}.pbf -b=${BOUNDS} \
        --complete-ways --complex-ways --complete-boundaries --complete-multipolygons \
        -o=${STATE}.o5m
done

echo "combining state region extracts..."

INPUTS=$(printf "%s.o5m " "${STATES[@]}")

osmconvert ${INPUTS} -o=cac.pbf

echo "all done!"
