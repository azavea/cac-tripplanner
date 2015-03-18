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
