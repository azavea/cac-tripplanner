import sys

from time import sleep

from collections import OrderedDict

import hashlib
import json
import logging

from boto import cloudformation
from boto.exception import BotoServerError

from troposphere import (
    Template,
    Ref,
    Output,
    Tags
)

# global across stacks per run


default_logger = logging.getLogger('cfntool')
formatter = logging.Formatter('[%(levelname)s] %(message)s')
stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setFormatter(formatter)
stdout_handler.setLevel(logging.DEBUG)
default_logger.addHandler(stdout_handler)
default_logger.setLevel(logging.DEBUG)


class MKInputError(Exception):
    """
    An error related to resolving an input.
    """
    pass


class MKUnresolvableInputError(MKInputError):
    """
    An error indicating the specified input is unresolvable.
    """
    pass


class MKNoSuchOutputError(MKUnresolvableInputError):
    """
    An error indicating the input connection was found but the output
    did not exist.
    """
    pass


class MKNoSuchStackError(MKUnresolvableInputError):
    """
    An error indicating the input connection was not found.
    """
    pass


class MKNoSuchInputError(MKInputError):
    """
    An error indicating the requested input is not defined.
    """
    pass


class StackNode(Template):
    """
    A node in an acyclic directed graph of cloudformation stacks which feed
    their outputs into inputs of other stacks.

    Also a subclass of a troposphere Template.

    This class is intended to be inherited, with the .set_up_stack method
    overridden.

    INPUTS contains a dict of input names and an associated list of strings
    describing where they might be resolved. For example, a key/value of
    'VpcId': ['global:VpcId', 'VPC:VpcId']
    will cause the input of VpcId to resolve as the output 'VpcId' from a node
    named "global" (which contains global variables in this case.) If VpcId is
    not in global's output, the input will resolve to the VpcId output of VPC.
    In the case of global:VpcId being provided the VPC node will not be run,
    unless it is required elsewhere.

    DEFAULT can contain default values for the inputs should they not be
    able to be resolved.

    """

    INPUTS = {}
    DEFAULTS = {}
    ATTRIBUTES = {}

    NAME = ''

    class states:
        IDLE = 0
        WAITING = 1
        RUNNING = 2
        FINISHED = 3
        FAILED = 4

    def __init__(self, **kwargs):
        """
        Initializes stack with defaults and connects inputs provided via
        **kwargs.

        Args:
          **kwargs (dict): Mapping of names of input nodes to their objects
        """
        super(StackNode, self).__init__()

        self.defaults = self.DEFAULTS.copy()
        self.inputs = self.INPUTS.copy()
        self.input_connections = {}
        self.input_connections.update(kwargs)
        if 'globalconfig' in self.input_connections:
            # global is a reserved word, so we allow using globalconfig instead
            self.input_connections['global'] = self.input_connections['globalconfig']
        self.requires = []
        self.waiting_on = []
        self.state = self.states.IDLE
        self.should_run = False
        self.input_wiring = {}
        self.last_heartbeat_id = None
        self.boto_conn = None
        self.stack_outputs = {}
        self.extra_outputs = {}
        self.stack_name = self.get_stack_name()

    def connect_from(self, stack, name=None):
        """
        Connects a node's outputs to this node's inputs.

        Args:
          stack (StackNode): The input node
          name (str): The string to use as the name. If left blank, the
            classname will be used.
        """
        if name is None:
            name = stack.__class__.__name__
        self.input_connections[name] = stack

    def connect_to(self, stack, name=None):
        """
        Connects a this node's output to another node's inputs.
        Syntactic sugar that calls .connect_from on the other node.

        Args:
          stack (StackNode): The node to connect to
          name (str): The string to use as the name for this node. If left
            blank, the classname will be used.
        """
        stack.connect_from(self, name)

    def get_from_input_address(self, input_address):
        """
        Method to resolve an input by its explicit input address ("VPC:VpcId",
        for example.)

        Args:
          input_address (str): The input address

        Returns:
          object: The resolved input
        """
        (input_connection, varname) = input_address.split(':', 1)
        if input_connection not in self.input_connections:
            raise MKNoSuchInputError
        if varname not in self.input_connections[input_connection].stack_outputs:
            raise MKNoSuchOutputError
        return self.input_connections[input_connection].stack_outputs[varname]

    def get_input(self, input_name):
        """
        Resolve a named input by cycling through its list and returning
        the first valid source

        Args:
          input_name (str): The name of the input

        Returns:
          object: The resolved input
        """
        if input_name not in self.inputs:
            raise MKNoSuchInputError
        for input_address in self.inputs[input_name]:
            try:
                return self.get_from_input_address(input_address)
            except MKUnresolvableInputError:
                pass
        if input_name not in self.defaults:
            raise MKUnresolvableInputError
        return self.defaults[input_name]

    @property
    def logger(self):
        """
        Tries to find a logger from the inputs, but if it can't be found
        returns the default logger from this module.

        Returns:
          logger: The logger from the 'logger' input if set, otherwise the
            default logger
        """
        try:
            return self.get_input('logger')
        except MKInputError:
            return default_logger

    def _calc_dependencies(self):
        """
        Cycle through all the inputs to find which connected nodes need to
        be run
        """
        for input_name, input_addresses in self.INPUTS.iteritems():
            try:
                self.get_input(input_name)
            except MKInputError:
                for input_address in input_addresses:
                    dependency = input_address.split(':', 1)[0]
                    if dependency in self.input_connections:
                        if (self.input_connections[dependency].state >=
                                self.states.FINISHED):
                            continue
                        if dependency not in self.requires:
                            self.requires.append(dependency)
                            break

    def set_up_stack(self):
        """
        This method should be overridden to set up the stack.
        """
        self.add_version('2010-09-09')

    def add_parameter(self, parameter, source=None):
        """
        Add a parameter to the CloudFormation template.
        Adds a source parameter to the Troposphere method to mark what input
        should be used to populate the field when running the stack, if any.

        Args:
          paramater (Parameter): the parameter to add to the template
          source (str): the name of the input to use to populate the paramater

        Returns:
          Paramater: the supplied parameter
        """
        param = super(StackNode, self).add_parameter(parameter)
        if source is not None:
            self.input_wiring[parameter.title] = source
        return param

    def create_resource(self, resource, output=None):
        """Helper method to attach resource to template and return it

        This helper method is used when adding _any_ CloudFormation resource
        to the template. It abstracts out the creation of the resource, adding
        it to the template, and optionally adding it to the outputs as well

        Args:
          resource: Troposphere resource to create
          output (str): name of output to return this value as
        """
        resource = self.add_resource(resource)

        if output:
            cloudformation_output = Output(
                output,
                Value=Ref(resource)
            )

            self.add_output(cloudformation_output)

        return resource

    def go(self):
        """
        Run the stack and the stacks this stack depends on. Calls .heartbeat
        down the graph every ten seconds until the state is FINISHED or
        FAILED.
        """
        n = 1
        self.heartbeat(0)
        while self.state < self.states.FINISHED:
            sleep(10)
            self.heartbeat(n)
            n += 1

    @property
    def suffix(self):
        """
        Return a suffix to append to the stack such that it is unique for
        all of the stack's attributes.

        Returns:
          str: Suffix for stack name
        """
        h = hashlib.sha256(json.dumps(self.get_raw_tags()))
        return h.hexdigest()

    def get_stack_name(self, with_suffix=True):
        """
        Returns a name for the stack. The stack suffix will contain a digest
        unique to this stack's attributes if with_suffix is true.

        Args:
          with_suffix (bool): Return the name of the stack with a unique suffix

        Returns:
          str: Name of the stack
        """
        if self.NAME != '':
            name = self.NAME
        else:
            name = self.__class__.__name__
        if with_suffix:
            return ('{}-{}'.format(name, self.suffix))[:32]
        else:
            return name

    def _launch_cfn(self):
        """
        Sets up stack and launches it.
        """
        self.set_up_stack()
        self.boto_conn = cloudformation.CloudFormationConnection()
        parameters = []
        for param, input_name in self.input_wiring.iteritems():
            try:
                parameters.append((param, self.get_input(input_name)))
            except MKInputError:
                pass
        # check to see if stack exists
        try:
            self.stack = self.boto_conn.describe_stacks(self.stack_name)[0]
        except BotoServerError:
            # it would be great if we could more granularly check the error
            self.boto_conn.create_stack(self.stack_name,
                                        tags=self.get_raw_tags(),
                                        template_body=self.to_json(),
                                        parameters=parameters)
            self.logger.info('Stack %s created', self.stack_name)

    def _check_cfn(self):
        """
        Checks the status of the stack
        """

        self.stack = self.boto_conn.describe_stacks(self.stack_name)[0]
        self.logger.debug('%s %s', self.stack_name,
                                self.stack.stack_status)
        return self.stack.stack_status

    def _assign_outputs(self):
        """
        Moves keys and values from boto output objects into dict.
        """
        self.stack_outputs = {}
        for output in self.stack.outputs:
            self.stack_outputs[output.key] = output.value
        self._custom_output_transform()

    def _custom_output_transform(self):
        """
        A method which is run after the stack completes which can be
        overridden and used to push additional data into the output.
        """
        pass

    def heartbeat(self, heartbeat_id):
        """
        Takes action to move the graph closer to completion. Will check if
        required inputs have run and will start if they have.

        Args:
          heartbeat_id (int): An identifier of the heartbeat being called.
            If this id matches the last hearbeat id, no action will be taken.
            This id will be used to call the hearbeat method on connected
            nodes.
        """
        if heartbeat_id == self.last_heartbeat_id:  # prevent multiple checks
            return self.state
        self.last_heartbeat_id = heartbeat_id
        if self.state == self.states.IDLE:
            self._calc_dependencies()
            self.state = self.states.WAITING
        if self.state == self.states.WAITING:  # wait on inputs
            to_remove = []
            for required in self.requires:
                if (self.input_connections[required].heartbeat(heartbeat_id) ==
                        self.states.FINISHED):
                    to_remove.append(required)
                if (self.input_connections[required].heartbeat(heartbeat_id) ==
                        self.states.FAILED):
                    self.state = self.states.FAILED
            self.requires = [required for required in self.requires if
                             required not in to_remove]
            if len(self.requires) == 0:
                self._launch_cfn()
                self.state = self.states.RUNNING
        if self.state == self.states.RUNNING:
            status = self._check_cfn()
            if status == 'ROLLBACK_COMPLETE':
                self.logger.error('%s failed', self.stack_name)
                self.state = self.states.FAILED
            elif status == 'CREATE_COMPLETE' or status == 'UPDATE_COMPLETE':
                self._assign_outputs()
                self.logger.info('%s finished', self.stack_name)
                self.state = self.states.FINISHED
        return self.state

    def get_raw_tags(self, **kwargs):
        tags = {'StackName': self.get_stack_name(False)}
        tags.update(kwargs)
        for k, v in self.ATTRIBUTES.iteritems():
            tags[k] = self.get_input(v)
        tags = OrderedDict(sorted(tags.iteritems(), key=lambda x: x[0]))
        # the above line protects us in case python ever changes its
        # hashing algorithm
        return tags

    def get_tags(self, **kwargs):
        return Tags(self.get_raw_tags(**kwargs))


class GlobalConfigNode(StackNode):
    """
    Node to hold config options
    """

    def __init__(self, **kwargs):
        """
        Initializes config node. This node will output any kwargs it is
        initialized with.

        Args:
          **kwargs (dict): List of outputs and their values.
        """
        super(GlobalConfigNode, self).__init__()
        self.stack_outputs = kwargs
        self.state = self.states.FINISHED  # don't do anything, just feed outputs


class NullNode(StackNode):
    """
    Node that does nothing except depends on other nodes. Currently this node
    is a bit inflexible, as it will insist that every node connected to it
    runs.
    """

    def _launch_cfn(self):
        pass

    def _check_cfn(self):
        return "CREATE_COMPLETE"

    def _calc_dependencies(self):
        self.requires = self.input_connections.keys()

    def _custom_output_transform(self):
        self.stack_outputs = {}
        for input_connection_name, input_connection in self.input_connections.iteritems():
            self.stack_outputs[input_connection_name] = input_connection.stack_outputs


class CustomActionNode(StackNode):
    def _launch_cfn(self):
        self.action()

    def action(self):
        """
        Override this method to specify an action this node should take.
        If this action creates any resources, it should check to make sure
        they exist first, and return the same outputs.

        Outputs should be defined as a dict in self.stack_outputs
        """
        pass

    def _check_cfn(self):
        """
        Indicate that the action has completed.

        In the future we might put some more abstraction here so that the logic
        doesn't have to decode status messages directly.
        """
        return "CREATE_COMPLETE"

    def _assign_outputs(self):
        """
        Do nothing so that the action method can set the outputs.
        """
        pass
