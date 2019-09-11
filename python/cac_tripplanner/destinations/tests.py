from datetime import timedelta
import json

from django.contrib.gis.geos import Point
from django.core.files import File
from django.urls import reverse
from django.test import Client, TestCase
from django.utils.timezone import now

from destinations.models import Destination, Event, EventDestination, Tour, TourDestination


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

    def test_event_detail_view(self):
        """Test that event detail view works"""
        url = reverse('event-detail',
                      kwargs={'pk': self.event_1.pk})
        response = self.client.get(url)
        self.assertContains(response, 'Current Event', status_code=200)

        # cannot view detail for unpublished event
        url = reverse('event-detail',
                      kwargs={'pk': self.event_2.pk})
        response_404 = self.client.get(url)
        self.assertEqual(response_404.status_code, 404)

    def test_event_search(self):
        """Test that event shows in search results"""
        url = reverse('api_destinations_search')
        response = self.client.get(url)
        self.assertContains(response, 'events', status_code=200)
        json_response = json.loads(response.content)
        self.assertEqual(len(json_response['events']), 1)
        event = json_response['events'][0]
        self.assertEqual(event['name'], 'Current Event')
        self.assertIn('Events', event['categories'])


class EventMultiDestinationTests(TestCase):
    def setUp(self):
        # Clear DB of objects created by migrations
        EventDestination.objects.all().delete()
        Event.objects.all().delete()
        Destination.objects.all().delete()

        test_image = File(open('default_media/square/BartramsGarden.jpg'))

        self.now = now()

        dest_args = dict(
            description='Sample place for tests',
            image=test_image,
            wide_image=test_image,
            point=Point(0, 0)
        )

        event_args = dict(
            description='Sample event for tests',
            image=test_image,
            wide_image=test_image
        )

        self.client = Client()

        self.place_1 = Destination.objects.create(
            name='place_one',
            published=True,
            **dest_args)

        self.place_2 = Destination.objects.create(
            name='place_two',
            published=False,
            **dest_args)

        self.event_1 = Event.objects.create(name='single_day_event',
                                            published=True,
                                            start_date=self.now,
                                            end_date=self.now + timedelta(days=1),
                                            **event_args)

        self.event_2 = Event.objects.create(name='multi_day_event',
                                            published=True,
                                            start_date=self.now - timedelta(days=7),
                                            end_date=self.now + timedelta(days=2),
                                            **event_args)

        self.event_1.event_destinations.add(
            EventDestination.objects.create(
                destination=self.place_1,
                related_event=self.event_1,
                order=2,
                start_date=self.now + timedelta(hours=8),
                end_date=self.now + timedelta(hours=14)
            ))

        self.event_1.event_destinations.add(
            EventDestination.objects.create(
                destination=self.place_2,
                related_event=self.event_1,
                order=1,
                start_date=self.now + timedelta(hours=14),
                end_date=self.now + timedelta(hours=18)
            ))

        self.event_1.save()

        self.event_2.event_destinations.add(
            EventDestination.objects.create(
                destination=self.place_1,
                related_event=self.event_2,
                order=1,
                start_date=self.now,
                end_date=self.now + timedelta(days=1)
            ))

        self.event_2.event_destinations.add(
            EventDestination.objects.create(
                destination=self.place_2,
                related_event=self.event_2,
                order=2,
                start_date=self.now + timedelta(days=1),
                end_date=self.now + timedelta(days=2)
            ))

        self.event_2.save()

    def test_event_manager_published(self):
        self.assertEqual(Event.objects.published().count(), 2)

    def test_event_manager_current(self):
        self.assertEqual(Event.objects.current().count(), 2)

    def test_event_detail_view(self):
        """Test that event detail view works"""
        url = reverse('event-detail',
                      kwargs={'pk': self.event_1.pk})
        response = self.client.get(url)
        self.assertContains(response, 'single_day_event', status_code=200)

        url = reverse('event-detail',
                      kwargs={'pk': self.event_2.pk})
        response = self.client.get(url)
        self.assertContains(response, 'multi_day_event', status_code=200)

    def test_event_destination_order(self):
        self.assertEqual(self.event_1.event_destinations.count(), 2)
        self.assertEqual(self.event_2.event_destinations.count(), 2)

        # second place should have first order, and be returned first
        event_1_first_dest = self.event_1.event_destinations.first()
        self.assertEqual(event_1_first_dest.order, 1)
        self.assertEqual(event_1_first_dest.destination.id,
                         self.place_2.id)
        # other place has second order
        self.assertEqual(self.event_1.event_destinations.all()[1].order, 2)

        self.assertEqual(self.event_2.event_destinations.first().order, 1)
        self.assertEqual(self.event_2.event_destinations.all()[1].order, 2)

    def test_event_search(self):
        """Test that events show in search results"""
        url = reverse('api_destinations_search')
        response = self.client.get(url)
        self.assertContains(response, 'events', status_code=200)
        json_response = json.loads(response.content)
        self.assertEqual(len(json_response['events']), 2)
        first_event = json_response['events'][0]
        # multi day event started earlier and should be listed first
        self.assertEqual(first_event['name'], 'multi_day_event')
        self.assertIn('Events', first_event['categories'])
        self.assertEqual(len(first_event['destinations']), 2)
        self.assertEqual(first_event['destinations'][0]['name'], 'place_one')
        self.assertEqual(first_event['destinations'][1]['name'], 'place_two')

        # single day event orders destinations differently
        second_event = json_response['events'][1]
        self.assertEqual(second_event['name'], 'single_day_event')
        self.assertEqual(len(second_event['destinations']), 2)
        self.assertEqual(second_event['destinations'][0]['name'], 'place_two')
        self.assertEqual(second_event['destinations'][1]['name'], 'place_one')


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

    def test_destination_search(self):
        """Test that destinations show in search results"""
        url = reverse('api_destinations_search') + '?text=place'
        response = self.client.get(url)
        self.assertContains(response, 'destinations', status_code=200)
        json_response = json.loads(response.content)
        self.assertEqual(len(json_response['destinations']), 2)


class TourTests(TestCase):
    def setUp(self):
        # Clear DB of objects created by migrations
        TourDestination.objects.all().delete()
        Tour.objects.all().delete()
        Destination.objects.all().delete()

        test_image = File(open('default_media/square/BartramsGarden.jpg'))

        self.now = now()

        dest_args = dict(
            description='Sample place for tests',
            image=test_image,
            wide_image=test_image,
            point=Point(0, 0)
        )

        tour_args = dict(
            description='Sample tour for tests'
        )

        self.client = Client()

        self.place_1 = Destination.objects.create(
            name='place_one',
            published=True,
            **dest_args)

        self.place_2 = Destination.objects.create(
            name='place_two',
            published=False,
            **dest_args)

        self.tour_1 = Tour.objects.create(name='tour_one',
                                          published=True,
                                          **tour_args)

        self.tour_2 = Tour.objects.create(name='tour_two',
                                          published=False,
                                          **tour_args)

        self.tour_1.tour_destinations.add(
            TourDestination.objects.create(
                destination=self.place_1,
                related_tour=self.tour_1,
                order=2
            ))

        self.tour_1.tour_destinations.add(
            TourDestination.objects.create(
                destination=self.place_2,
                related_tour=self.tour_1,
                order=1
            ))

        self.tour_1.save()

        self.tour_2.tour_destinations.add(
            TourDestination.objects.create(
                destination=self.place_1,
                related_tour=self.tour_2,
                order=1
            ))

        self.tour_2.tour_destinations.add(
            TourDestination.objects.create(
                destination=self.place_2,
                related_tour=self.tour_2,
                order=2
            ))

        self.tour_2.save()

    def test_tour_manager_published(self):
        self.assertEqual(Tour.objects.published().count(), 1)
        self.assertEqual(Tour.objects.count(), 2)

    def test_tour_detail_view(self):
        """Test that tour detail view works"""
        url = reverse('tour-detail',
                      kwargs={'pk': self.tour_1.pk})
        response = self.client.get(url)
        self.assertContains(response, 'tour_one', status_code=200)

        # unpublished tour detail should not be available
        url = reverse('tour-detail',
                      kwargs={'pk': self.tour_2.pk})
        response_404 = self.client.get(url)
        self.assertEqual(response_404.status_code, 404)

    def test_tour_search(self):
        """Test that tour shows in search results"""
        url = reverse('api_destinations_search')
        response = self.client.get(url)
        self.assertContains(response, 'tours', status_code=200)
        json_response = json.loads(response.content)
        self.assertEqual(len(json_response['tours']), 1)

    def test_tour_destination_order(self):
        self.assertEqual(self.tour_1.tour_destinations.count(), 2)
        self.assertEqual(self.tour_2.tour_destinations.count(), 2)

        # second place should have first order, and be returned first
        tour_1_first_dest = self.tour_1.tour_destinations.first()
        self.assertEqual(tour_1_first_dest.order, 1)
        self.assertEqual(tour_1_first_dest.destination.id,
                         self.place_2.id)
        # other place has second order
        self.assertEqual(self.tour_1.tour_destinations.all()[1].order, 2)

        self.assertEqual(self.tour_2.tour_destinations.first().order, 1)
        self.assertEqual(self.tour_2.tour_destinations.all()[1].order, 2)
