# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.require_version ">= 2.0"
require "yaml"

CAC_SHARED_FOLDER_TYPE = ENV.fetch("CAC_SHARED_FOLDER_TYPE", "nfs")
CAC_NFS_VERSION =  'vers=4'

if CAC_SHARED_FOLDER_TYPE == "nfs"
  if Vagrant::Util::Platform.linux? then
    CAC_MOUNT_OPTIONS = ['rw', CAC_NFS_VERSION, 'tcp', 'nolock', 'actimeo=1']
  else
    CAC_MOUNT_OPTIONS = [CAC_NFS_VERSION, 'udp', 'actimeo=1']
  end
else
  if ENV.has_key?("CAC_MOUNT_OPTIONS")
    CAC_MOUNT_OPTIONS = ENV.fetch("CAC_MOUNT_OPTIONS").split
  else
    CAC_MOUNT_OPTIONS = ["rw"]
  end
end

if ENV['CAC_TRIPPLANNER_MEMORY'].nil?
  # OpenTripPlanner needs > 1GB to build and run
  CAC_MEMORY_MB = "8192"
else
  CAC_MEMORY_MB = ENV['CAC_TRIPPLANNER_MEMORY']
end

if ENV['CAC_TRIPPLANNER_CPU'].nil?
  CPUS = "2"
else
  CPUS = ENV['CAC_TRIPPLANNER_CPU']
end

def testing?
  !ENV["VAGRANT_ENV"].nil? && ENV["VAGRANT_ENV"] == "TEST"
end

# Deserialize Ansible Galaxy installation metadata for a role
def galaxy_install_info(role_name)
  role_path = File.join("deployment", "ansible", "roles", role_name)
  galaxy_install_info = File.join(role_path, "meta", ".galaxy_install_info")

  if (File.directory?(role_path) || File.symlink?(role_path)) && File.exists?(galaxy_install_info)
    YAML.load_file(galaxy_install_info)
  else
    { install_date: "", version: "0.0.0" }
  end
end

# Uses the contents of roles.txt to ensure that ansible-galaxy is run
# if any dependencies are missing
def install_dependent_roles
  ansible_directory = File.join("deployment", "ansible")
  ansible_roles_spec = File.join(ansible_directory, "roles.yml")

  YAML.load_file(ansible_roles_spec).each do |role|
    role_name = role["name"] ? role["name"] : role["src"]
    role_version = role["version"]
    role_path = File.join(ansible_directory, "roles", role_name)
    galaxy_metadata = galaxy_install_info(role_name)

    if galaxy_metadata["version"] != role_version.strip
      unless system("ansible-galaxy install -f -r #{ansible_roles_spec} -p #{File.dirname(role_path)}")
        $stderr.puts "\nERROR: An attempt to install Ansible role dependencies failed."
        exit(1)
      end

      break
    end
  end
end

# Install missing role dependencies based on the contents of roles.txt
if [ "up", "provision" ].include?(ARGV.first)
  install_dependent_roles
end

ANSIBLE_INVENTORY_PATH = if testing?
  "deployment/ansible/inventory/test"
else
  "deployment/ansible/inventory/development"
end

VAGRANT_PROXYCONF_ENDPOINT = ENV["VAGRANT_PROXYCONF_ENDPOINT"]
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "bento/ubuntu-16.04"

  # Wire up the proxy if:
  #
  #   - The vagrant-proxyconf Vagrant plugin is installed
  #   - The user set the VAGRANT_PROXYCONF_ENDPOINT environmental variable
  #
  if Vagrant.has_plugin?("vagrant-proxyconf") &&
     !VAGRANT_PROXYCONF_ENDPOINT.nil?
    config.proxy.http     = VAGRANT_PROXYCONF_ENDPOINT
    config.proxy.https    = VAGRANT_PROXYCONF_ENDPOINT
    config.proxy.no_proxy = "localhost,127.0.0.1"
  end

  config.vm.define "database" do |database|
    database.vm.hostname = "database"
    database.vm.network "private_network", ip: "192.168.8.25"

    database.vm.synced_folder ".", "/vagrant", disabled: true

    database.ssh.forward_x11 = true

    database.vm.provision "ansible" do |ansible|
      ansible.compatibility_mode = "2.0"
      ansible.playbook = "deployment/ansible/database.yml"
      ansible.inventory_path = ANSIBLE_INVENTORY_PATH
      ansible.raw_arguments = ["--timeout=60"]
    end

    if ENV['CAC_DATABASE_MEMORY'].nil?
      DB_MEMORY_MB = "512"
    else
      DB_MEMORY_MB = ENV['CAC_DATABASE_MEMORY']
    end

    database.vm.provider :virtualbox do |v|
      v.memory = DB_MEMORY_MB
      v.cpus = 2
    end
  end

  config.vm.define "app" do |app|
    app.vm.hostname = "app"
    app.vm.network "private_network", ip: "192.168.8.24"

    if testing?
        app.vm.synced_folder ".", "/opt/app"
    else
      app.vm.synced_folder ".", "/opt/app",
        type: CAC_SHARED_FOLDER_TYPE,
        mount_options: CAC_MOUNT_OPTIONS
    end

    # Web
    app.vm.network "forwarded_port", guest: 443, host: 8024

    # Django Dev
    app.vm.network "forwarded_port", guest: 8026, host: 8026


    app.ssh.forward_x11 = true

    app.vm.provision "ansible" do |ansible|
      ansible.compatibility_mode = "2.0"
      ansible.playbook = "deployment/ansible/app.yml"
      ansible.inventory_path = ANSIBLE_INVENTORY_PATH
      ansible.raw_arguments = ["--timeout=60"]
    end

    if ENV['CAC_APP_MEMORY'].nil?
      APP_MEMORY_MB = "1024"
    else
      APP_MEMORY_MB = ENV['CAC_APP_MEMORY']
    end

    app.vm.provider :virtualbox do |v|
      v.memory = APP_MEMORY_MB
      v.cpus = 2
    end
  end

  config.vm.define "otp" do |otp|
    otp.vm.hostname = "otp"
    otp.vm.network "private_network", ip: "192.168.8.26"

    otp.vm.synced_folder ".", "/vagrant", disabled: true

    # OpenTripPlanner
    otp.vm.network "forwarded_port", guest: 80, host: 9090

    otp.ssh.forward_x11 = true

    otp.vm.provision "ansible" do |ansible|
      ansible.compatibility_mode = "2.0"
      ansible.playbook = "deployment/ansible/otp.yml"
      ansible.inventory_path = ANSIBLE_INVENTORY_PATH
      ansible.raw_arguments = ["--timeout=60"]
    end

    otp.vm.provider :virtualbox do |v|
      v.memory = CAC_MEMORY_MB
      v.cpus = CPUS
    end
  end

end
