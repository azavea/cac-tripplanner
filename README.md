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
4. `vagrant ssh`
5. `. /app_env/activate`
6. `cd /vagrant/python/cac_tripplanner`
7. `./manage.py migrate`
8. `./manage.py runserver [::]:8000`
9. Access with your browser at http://localhost:8024/
