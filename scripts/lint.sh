#!/bin/bash

function mark_unstable {
    java -jar jenkins-cli.jar -s $JENKINS_URI set-build-result unstable
}

set -x
trap 'mark_unstable' ERR

# Python linting
vagrant ssh app -c "flake8 /opt/app/python --exclude migrations"

# Run JS linting
vagrant ssh app -c "cd /opt/app/src && npm run gulp-lint-jenkins"
