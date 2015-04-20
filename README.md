Clean Air Council Circuit Trip Planner and Travelshed
=====================================================


Development Dependencies
------------------------

* [Vagrant](http://www.vagrantup.com)
* [Ansible](http://www.ansible.com)

Development Installation
------------------------

1. Make sure you have the development dependencies installed
2. Place GTFS .zip files, OSM files, and elevation .tif files (optional) in the otp_data folder
3. Copy `deployment/ansible/group_vars/development_template` to `deployment/ansible/group_vars/development` and edit variables
4. Run `vagrant up`
5. See the app at http://localhost:8024! See OpenTripPlanner at http://localhost:9090.
6. Running `npm run gulp-watch` from `/opt/app/src` will automatically collect static files together when changes are detected for Django template consumption.

Building AMIs
------------------------
1. Make a production group_vars file (similarly to how is described above with development). Make sure production is set to true, and also specify an app_username, which should be set to: ubuntu
2. Install Packer from: `https://www.packer.io/downloads.html`
3. In the project directory, run: `deployment/cac-stack.py create-ami --aws-access-key-id YOUR_ACCESS_KEY --aws-secret-access-key YOUR_SECRET_KEY --aws-role-arn YOUR_ASSUMED_ROLE_ARN`
4. The previous command builds all AMIs. To only build a single AMI, run the same command, but also specify the `--machine-type` parameter, which may be set to one of: `bastion`, `otp`, or `web`.

Launching AWS Stacks
------------------------
Note: the file majorkirby.py in deployment/cloudformation is a direct copy of a development version of major kirby. Once major kirby has been released, this file should be removed, and installation should occur via pip.

1. Copy `deployment/default_template.yaml` to `deployment/default.yaml` and edit variables
2. In the project directory, for a set of `Blue` stacks in the `Production` environment, run: `deployment/cac-stack.py launch-stacks --stack-type prod --stack-color blue --aws-access-key-id YOUR_ACCESS_KEY --aws-secret-access-key YOUR_SECRET_KEY --aws-role-arn YOUR_ASSUMED_ROLE_ARN`
3. The previous command will do the following:
 * Ensure the `VPC` stack is up in Production -- it will be launched if it isn't already running
 * Ensure the `DataPlane` stack is up in Production -- it will be launched if it isn't already running
 * Ensure the `OtpServer` Blue stack is up in Production -- it will be launched if it isn't already running
 * Ensure the `WebServer` Blue stack is up in Production -- it will be launched if it isn't already running
4. Note that database migrations are not automatically run. When the DataPlane is first brought up, it is necessary to manually create the app user/db and run migrations.
5. Launching a set of Production stacks with the other color (`Green`), will use the same `VPC` and `DataPlane` stacks, but will create different `OtpServer` and `WebServer` stacks (if they don't already exist).
6. In order to perform a Blue/Green deployment, check which color stacks are running in Production and launch the opposite. After the new stacks are tested thoroughly, switch the public DNS record to point to the new `WebServer` ELB DNS. When traffic is no longer being routed to the stacks of the previous color and the deployment is satisfactory, the stacks of the previous color may be deleted.
