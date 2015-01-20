#!/bin/bash
DIR=$(cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd)
# The otp machine is currently disabled because it takes a long time, the built-in
# OTP tests apparently don't work very well, and we don't have any other tests that use it yet.
vagrant up app database --no-provision
for vm in database app;
do
    vagrant provision ${vm}
done
