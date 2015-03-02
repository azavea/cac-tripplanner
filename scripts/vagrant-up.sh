#!/bin/bash
DIR=$(cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd)

vagrant up otp app database --no-provision
for vm in otp database app;
do
    vagrant provision ${vm}
done
