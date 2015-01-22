import os
import json

from django.test import TestCase

from django.contrib.gis.geos import GEOSGeometry

from destinations.models import Destination

class CACTripPlannerIsochroneTestCase(object):
    """ Test behavior of within-isochrone view """

    def setUp(self):
        file_directory = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(file_directory, 'testing', 'test_point.json'), 'r') as json_point:
            test_point = json.load(json_point)

        Destination.objects.create(
            name='test',
            description='A simple test destination',
            point=GEOSGeometry(json.dumps(test_point)),
            address='123 Test ln.',
            city='Gotham',
            state='Euphoria',
            zip='12345',
            published=True
        )


