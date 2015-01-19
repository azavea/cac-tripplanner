Clean Air Council Circuit Trip Planner and Travelshed
=====================================================


Development Dependencies
------------------------

* [Vagrant](http://www.vagrantup.com)
* [Ansible](http://www.ansible.com)

Development Installation
------------------------

1. Make sure you have the development dependencies installed
2. Place `septa_bus.zip`, `septa_rail.zip`, and `patco.zip` in the gtfs folder
3. Run `vagrant up`
4. See the app at http://localhost:8024! See OpenTripPlanner at http://localhost:9090.
5. During development, running `gulp watch` from `/opt/app/src` will automatically collect static files together when changes are detected for Django template consumption.
