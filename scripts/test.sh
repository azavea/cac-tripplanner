#!/bin/bash

set -e
set -x

# Run the Django test suite with --noinput flag.
vagrant ssh app -c "cd /opt/app/python/cac_tripplanner && ./manage.py test --noinput"

