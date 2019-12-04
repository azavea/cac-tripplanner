#!/bin/bash

set -x

# Run JS and styles watcher to rebuild frontend on file change
# (Page reload still required)
vagrant ssh app -c "cd /opt/app/src && npm run gulp"
