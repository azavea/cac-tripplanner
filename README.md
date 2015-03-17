Clean Air Council Circuit Trip Planner and Travelshed
=====================================================


Development Dependencies
------------------------

* [Vagrant](http://www.vagrantup.com)
* [Ansible](http://www.ansible.com)

Development Installation
------------------------

1. Make sure you have the development dependencies installed
2. Place GTFS .zip files and elevation .tif files (optional) in the otp_data folder
3. Run `vagrant up`
4. See the app at http://localhost:8024! See OpenTripPlanner at http://localhost:9090.
5. Running `npm run gulp-watch` from `/opt/app/src` will automatically collect static files together when changes are detected for Django template consumption.
