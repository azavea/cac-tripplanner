from datetime import timedelta

from django.contrib.gis.geos import Point
from django.core.files import File
from django.core.urlresolvers import reverse
from django.test import Client, TestCase
from django.utils.timezone import now

from destinations.models import Destination, FeedEvent


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


class FeedEventTests(TestCase):

    def setUp(self):
        common_args = {
            'point': Point(0, 0),
            'title': 'Test article',
            'content': 'Test content',
            'description': 'Test description',
            'link': 'http://uwishunu.com',
            'author': 'John Smith',
            'categories': 'Events'
        }
        past_published = now() - timedelta(hours=1)
        future_published = now() + timedelta(hours=1)

        self.pub_future_end_past = FeedEvent.objects.create(
            guid='1',
            publication_date=future_published,
            end_date=past_published,
            **common_args)
        self.pub_past_end_future = FeedEvent.objects.create(
            guid='2',
            publication_date=past_published,
            end_date=future_published,
            **common_args)
        self.pub_future_end_future = FeedEvent.objects.create(
            guid='3',
            publication_date=future_published,
            end_date=future_published,
            **common_args)
        self.pub_past_end_past = FeedEvent.objects.create(
            guid='4',
            publication_date=past_published,
            end_date=past_published,
            **common_args)

    def test_feed_event_manager(self):

        published_count = FeedEvent.objects.published().count()
        self.assertEqual(published_count, 1)

    def test_published_property(self):
        """ Only events that have published < now and end_date > now should be valid """
        self.assertFalse(self.pub_future_end_past.published)
        self.assertTrue(self.pub_past_end_future.published)
        self.assertFalse(self.pub_future_end_future.published)
        self.assertFalse(self.pub_past_end_past.published)
