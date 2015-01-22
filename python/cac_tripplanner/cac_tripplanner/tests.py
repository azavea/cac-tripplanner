import os
import json

from django.test import TestCase, Client

from django.contrib.gis.geos import GEOSGeometry

from destinations.models import Destination

class CACTripPlannerIsochroneTestCase(TestCase):
    """ Test behavior of within-isochrone view """

    def setUp(self):
        file_directory = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(file_directory, 'testing', 'test_point_inside.json'),
                  'r') as json_point:
            test_point_inside = json.load(json_point)
        with open(os.path.join(file_directory, 'testing', 'test_point_outside.json'),
                  'r') as json_point:
            test_point_outside = json.load(json_point)

        self.client = Client()
        self.test_point_inside = GEOSGeometry(json.dumps(test_point_inside))
        self.test_point_outside = GEOSGeometry(json.dumps(test_point_outside))
        Destination.objects.create(
            name='testWithin',
            description='A simple test destination',
            point=self.test_point_inside,
            address='123 Test ln.',
            city='Gotham',
            state='Euphoria',
            zip='12345',
            published=True
        )
        Destination.objects.create(
            name='testWithout',
            description='A simple test destination',
            point=self.test_point_outside,
            address='123 Test ln.',
            city='Thangorodrim',
            state='Angband',
            zip='12349',
            published=True
        )


    def test_points_exists(self):
        """Diagnose setup's success in creating points"""
        self.assertEqual(Destination.objects.filter(name='testWithin')[0].point,
                         self.test_point_inside)
        self.assertEqual(Destination.objects.filter(name='testWithout')[0].point,
                         self.test_point_outside)


    def test_isochrone_partitioning(self):
        """Ensure that our pet isochrone correctly demarcates between points within and
        points outside of its boundary"""
        isochrone_url = '/reachable?coords%5Blat%5D=39.954688&coords%5Blng%5D=-75.204677&mode%5B%5D=WALK&mode%5B%5D=TRANSIT&date=01-21-2015&time=7%3A30am&maxTravelTime=5000&maxWalkDistance=5000'
        response = self.client.get(isochrone_url)
        self.assertEqual('{"matched": "[<Destination: testWithin>]"}', response.content)








