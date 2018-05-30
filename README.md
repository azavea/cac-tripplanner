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
3. Copy `deployment/ansible/group_vars/development_template` to `deployment/ansible/group_vars/development`
4. Run `vagrant up`
5. See the app at http://localhost:8024! See OpenTripPlanner at http://localhost:9090.
6. Running `npm run gulp-watch` from `/opt/app/src` will automatically collect static files together when changes are detected for Django template consumption. Alternatively, `npm run gulp-development` can be run manually whenever changes are made to the static files.

Note that if there is an existing build Graph.obj in `otp_data`, vagrant provisioning in development mode will not attempt to rebuild the graph, but will use the one already present.

Building AMIs
------------------------
1. Make a production group_vars file (similarly to how is described above with development). Make sure production is set to true, and also specify an app_username, which should be set to: ubuntu
2. If building the `otp` machine, make sure the latest GTFS are in `otp_data`, then build a graph when them in the development environment provisioning.  This will result in a new `Graph.obj` file being written to `otp_data`.
3. In the project directory within the app VM, run: `deployment/cac-stack.py create-ami --aws-access-key-id YOUR_ACCESS_KEY --aws-secret-access-key YOUR_SECRET_KEY --aws-role-arn YOUR_ASSUMED_ROLE_ARN`
4. The previous command builds all AMIs. To only build a single AMI, run the same command, but also specify the `--machine-type` parameter, which may be set to one of: `bastion`, `otp`, or `app`.

Launching AWS Stacks
------------------------
1. Copy `deployment/default_template.yaml` to `deployment/default.yaml` and edit variables
2. In the project directory, for a set of `Blue` stacks in the `Production` environment, run: `deployment/cac-stack.py launch-stacks --stack-type prod --stack-color blue --aws-access-key-id YOUR_ACCESS_KEY --aws-secret-access-key YOUR_SECRET_KEY --aws-role-arn YOUR_ASSUMED_ROLE_ARN`
3. The previous command will do the following:
 * Ensure the `VPC` stack is up in Production -- it will be launched if it isn't already running
 * Ensure the `DataPlane` stack is up in Production -- it will be launched if it isn't already running
 * Ensure the `OtpServer` Blue stack is up in Production -- it will be launched if it isn't already running
 * Ensure the `WebServer` Blue stack is up in Production -- it will be launched if it isn't already running
4. Note that database migrations are not automatically run. When the DataPlane is first brought up, it is necessary to manually create the app user/db and run migrations.
5. Launching a set of Production stacks with the other color (`Green`), will use the same `VPC` and `DataPlane` stacks, but will create different `OtpServer` and `WebServer` stacks (if they don't already exist).

Production Blue/Green deployment
--------------------------------
1. Note which color is currently running in production. Use the opposite color in the following steps.
2. Set `otp_host` in production group_vars to the CloudFront distribution with the desired color.
3. Run `create_ami` command to build new AMIs.
4. Update `default.yaml` with new AMI ids.
5. Run `launch_stacks` command to launch stacks with the desired color.
6. Test new stacks thoroughly.
7. Switch the public DNS record of the site to point to the new `WebServer` ELB DNS.
8. The stacks of the previous color may be deleted when ready.
