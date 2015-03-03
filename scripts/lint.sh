#!/bin/bash

function mark_unstable {
    java -jar jenkins-cli.jar -s $JENKINS_URI set-build-result unstable
}

set -x
trap 'mark_unstable' ERR

# Python linting
# save to file in format jenkins can read: http://stackoverflow.com/a/5426251
vagrant ssh app -c "flake8 /opt/app/python --exclude migrations | awk -F\: '{printf '\''%s:%s: [%s]%s\n'\'', $1, $2, substr($4,2,4), substr($4,6)}' > /opt/app/python/violations.txt"

# Run JS linting
vagrant ssh app -c "cd /opt/app/src && npm run gulp-lint-jenkins"
