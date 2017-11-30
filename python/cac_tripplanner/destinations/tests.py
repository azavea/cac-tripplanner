from datetime import timedelta

from django.contrib.gis.geos import Point
from django.core.files import File
from django.core.urlresolvers import reverse
from django.test import Client, TestCase
from django.utils.timezone import now

from destinations.models import Destination, Event


class EventTests(TestCase):
    def setUp(self):
        # Clear DB of objects created by migrations
        Event.objects.all().delete()

        test_image = File(open('default_media/square/BartramsGarden.jpg'))

        self.now = now()

        common_args = dict(
            description='Sample event for tests',
            image=test_image,
            wide_image=test_image
        )

        self.client = Client()

        self.event_1 = Event.objects.create(name='Current Event',
                                            published=True,
                                            start_date=self.now,
                                            end_date=self.now + timedelta(days=1),
                                            **common_args)

        self.event_2 = Event.objects.create(name='Unpublished Past Event',
                                            published=False,
                                            start_date=self.now - timedelta(days=7),
                                            end_date=self.now - timedelta(days=2),
                                            **common_args)

    def test_event_manager_published(self):
        self.assertEqual(Event.objects.published().count(), 1)

    def test_event_manager_current(self):
        self.assertEqual(Event.objects.current().count(), 1)


class DestinationTests(TestCase):
    def setUp(self):

        # Clear DB of objects created by migrations
        Destination.objects.all().delete()

        test_image = File(open('default_media/square/BartramsGarden.jpg'))

        common_args = dict(
            description='Sample place for tests',
            image=test_image,
            wide_image=test_image,
            point=Point(0, 0)
        )

        self.client = Client()

        self.place_1 = Destination.objects.create(
            name='place_one',
            published=True,
            **common_args)

        self.place_2 = Destination.objects.create(
            name='place_two',
            published=True,
            **common_args)

        self.place_3 = Destination.objects.create(
            name='place_three',
            published=False,
            **common_args)

    def test_destination_manager_published(self):
        self.assertEqual(Destination.objects.published().count(), 2)

    def test_place_detail_view(self):
        """Test that place detail view works"""
        url = reverse('place-detail',
                      kwargs={'pk': self.place_1.pk})
        response = self.client.get(url)
        self.assertContains(response, 'place_one', status_code=200)

        url = reverse('place-detail',
                      kwargs={'pk': self.place_3.pk})
        response_404 = self.client.get(url)
        self.assertEqual(response_404.status_code, 404)
