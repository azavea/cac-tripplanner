#!/bin/bash

function mark_unstable {
    java -jar jenkins-cli.jar -s $JENKINS_URI set-build-result unstable
}

set -x
trap 'mark_unstable' ERR

# Python linting
vagrant ssh app -c "flake8 /opt/app/python --exclude=migrations"
# run twice to get console output and to write to file
vagrant ssh app -c "flake8 /opt/app/python --exclude=migrations --output-file=/opt/app/python/violations.txt"

# Run JS linting
vagrant ssh app -c "cd /opt/app/src && npm run gulp-lint"
# Run again, writing results to file.
# First delete previous lint file, if it exists, and create an empty file (in case no warnings found).
vagrant ssh app -c "cd /opt/app/src && rm -f coverage/jshint-output.xml && touch coverage/jshint-output.xml && npm run gulp-lint-jenkins"
