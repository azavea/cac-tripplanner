from majorkirby import GlobalConfigNode

from vpc import VPC
from data import DataPlaneGenerator
from app import (
    OtpServerStack,
    WebServerStack
)
from privatehostedzone import R53PrivateHostedZone


stack_types = {
    'dev': 'Development',
    'staging': 'Staging',
    'prod': 'Production'
}

stack_colors = {
    'green': 'Green',
    'blue': 'Blue'
}


def build_stacks(options, stack_type, stack_color):
    """
    Given options, the stack type, and an optional stack color, build
    the stack graph and launch the stacks.

    If the stack color is specified, this will build the full stack.
    If it is not, it will only build up to the data plane node.
    """
    options['StackType'] = stack_types[stack_type.lower()]
    if stack_color:
        options['StackColor'] = stack_colors[stack_color.lower()]
    g = GlobalConfigNode(**options)
    v = VPC(globalconfig=g)
    hs = R53PrivateHostedZone(globalconfig=g, VPC=v)
    d = DataPlaneGenerator(globalconfig=g, VPC=v, R53PrivateHostedZone=hs)
    if not stack_color:
        d.go()
    else:
        OtpServerStack(globalconfig=g, VPC=v, DataPlane=d).go()
        WebServerStack(globalconfig=g, VPC=v, DataPlane=d).go()
