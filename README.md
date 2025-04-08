Clean Air Council Circuit Trip Planner and Travelshed
=====================================================


Development Dependencies
------------------------

* [Vagrant](http://www.vagrantup.com)
* [Ansible](http://www.ansible.com) v4 (versions 6+ seem not to work)


Development Installation
------------------------

1. Make sure you have the development dependencies installed
2. Download the latest Graph.obj for OTP: `scripts/download-latest-graph.sh`
     - This will take ~10 minutes to download
     - If you already have a local graph file but want the latest from S3, run `scripts/download-latest-graph.sh --force`
3. Copy `deployment/ansible/group_vars/development_template` to `deployment/ansible/group_vars/development`
4. Change into the `src/` folder and run `npm install` to install the node modules on the host machine
5. Run `vagrant up`. You can choose to change the Virtualbox shared folder type for the `app` VM from its default VirtualBox by:
```
CAC_APP_SHARED_FOLDER_TYPE=nfs vagrant up
```
6. See the app at http://localhost:8024! See OpenTripPlanner at http://localhost:9090.
7. Running `./scripts/serve-js-dev.sh` on the host will rebuild the front-end app on file change (the browser must be reloaded manually to pick up the change). Alternatively, `cd /opt/app/src && npm run gulp-development` can be run manually in the VM to pick up changes to the static files.

Note that if there is an existing build Graph.obj in `otp_data`, vagrant provisioning in development mode will not attempt to rebuild the graph, but will use the one already present.

Django migrations are run as part of app provisioning, [here](https://github.com/azavea/cac-tripplanner/blob/develop/deployment/ansible/roles/cac-tripplanner.app/tasks/main.yml#L67-L72), but there may be instances where you need to manually run migrations outside of provisioning, in which case use the command:
```
vagrant ssh app -c 'cd /opt/app/python/cac_tripplanner && python3 manage.py migrate'
```

Production Deployment
------------------------
*Note there is no staging environment*
1. Dispatch "Build Graph" Github Actions workflow
     - This will fetch and process the latest GTFS and OSM files, store them on S3, and then use those files (along with the elevation file) to build a new Graph.obj for the OTP builder. New Graph.obj will also be stored in S3 bucket.
2. Once workflow completes (3-4 hours), remove everything from your local `otp_data` directory and then run the following script to pull the latest Graph.obj: `scripts/download-latest-graph.sh`
3. Build the AMIs, follow latest instructions in `Building The AMIs` section of deployment instrucions, [found here](https://github.com/azavea/geospatial-apps/blob/master/gophillygo_deployment.md#building-the-amis).
4. Once AMI builds complete and identifiers set, following latest instructions in `Deploying the AMIs` section of deployment instructions, [found here](https://github.com/azavea/geospatial-apps/blob/master/gophillygo_deployment.md#deploying-the-amis).
