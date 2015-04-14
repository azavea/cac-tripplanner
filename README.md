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

Building AMIs via Packer
------------------------
1. Make a production group_vars file (similarly to how is described above with development). Make sure production is set to true, and also specify an app_username, which should be set to: ubuntu
2. Install Packer from: https://www.packer.io/downloads.html
3. In the project directory, run: packer build -var 'aws_access_key=YOURaccessKEYhere' -var 'aws_secret_key=YOURsecretKEYhere' deployment/packer/cac.json
