from datetime import timedelta

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils.timezone import now

from destinations.models import FeedEvent


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

        self.future_event = FeedEvent.objects.create(
            guid='1',
            publication_date=future_published,
            **common_args)
        self.past_event = FeedEvent.objects.create(
            guid='2',
            publication_date=past_published,
            **common_args)
        self.past_event_two = FeedEvent.objects.create(
            guid='3',
            publication_date=past_published,
            **common_args)

    def test_feed_event_manager(self):

        published_count = FeedEvent.objects.published().count()
        self.assertEqual(published_count, 2)

    def test_published_property(self):
        self.assertFalse(self.future_event.published)
        self.assertTrue(self.past_event.published)
