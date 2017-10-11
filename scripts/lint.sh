#!/bin/bash

function mark_unstable {
    java -jar jenkins-cli.jar -s "$JENKINS_URI set-build-result unstable"
}

set -x
trap 'mark_unstable' ERR

# Python linting
# first remove violations file, as it will not get overwritten if there are no warnings
vagrant ssh app -c "if [ -e /opt/app/python/violations.txt ]; then rm /opt/app/python/violations.txt; fi"
# get console output and to write to file
vagrant ssh app -c "flake8 /opt/app/python --exclude=migrations
                    --output-file=/opt/app/python/violations.txt --exit-zero --tee"

# Run JS linting
vagrant ssh app -c "cd /opt/app/src && npm run gulp-lint"
# Run again, writing results to file.
vagrant ssh app -c "cd /opt/app/src && npm run gulp-lint-jenkins"
