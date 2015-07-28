from datetime import datetime
import urllib2
from xml.dom import minidom

from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from destinations.models import FeedEvent

from pytz import utc


class Command(BaseCommand):
    args = ''
    help = 'Load the current Uwishunu feed into the FeedEvent table'

    now = utc.localize(datetime.utcnow())

    def property_exists(self, item, property_name):
        """ Check if a property exists as a child of the given element """
        return item.getElementsByTagName(property_name).length > 0

    def get_property(self, item, property_name):
        """ Retrieve the value of an xml property name from another xml element """
        elements = item.getElementsByTagName(property_name)
        if elements.length > 0 and elements[0].firstChild:
            return elements[0].firstChild.data
        else:
            return None

    def parse_date(self, string_datetime):
        """ Parse a date from the feed, return datetime localized to US/Eastern """
        if not string_datetime:
            return None
        try:
            parsed_date = datetime.strptime(string_datetime, '%a, %d %b %Y %H:%M:%S +0000')
        except ValueError:
            return None
        return utc.localize(parsed_date)

    def handle(self, *args, **options):
        """ Retrieve and populate FeedEvent table from an RSS Feed """

        url = 'http://www.uwishunu.com/feed/google/'
        # Get 403 forbidden without changing user-agent
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux i686; rv:10.0) Gecko/20100101 Firefox/10.0'
        }
        request = urllib2.Request(url, None, headers)
        feed = minidom.parse(urllib2.urlopen(request))

        for item in feed.getElementsByTagName('item'):
            self.handle_feed_item(item)

        self.delete_expired()

    def handle_feed_item(self, item):
        """ Update or create a FeedEvent based on a unique identifier """

        # Unique field
        guid = self.get_property(item, 'guid')

        # need a lat/lng to care about this item
        if not self.property_exists(item, 'georss:point'):
            return

        # Other fields
        author = self.get_property(item, 'dc:creator')

        categories_list = [cat.firstChild.data for cat in item.getElementsByTagName('category')]
        categories = ','.join(categories_list)

        content = self.get_property(item, 'content:encoded')

        description = self.get_property(item, 'description')

        link = self.get_property(item, 'link')

        try:
            georss = self.get_property(item, 'georss:point').split()
            lat = float(georss[0])
            lon = float(georss[1])
        except (ValueError, IndexError):
            self.stdout.write('Unable to convert lat/lng for: {0}'.format(guid))
            return

        point = Point(lon, lat)

        publication_date = self.parse_date(self.get_property(item, 'pubDate'))
        end_date = self.parse_date(self.get_property(item, 'fieldtrip:endDate'))
        if publication_date is None or end_date is None or end_date < self.now:
            # Skip event if in past or bad/empty dates
            return

        image_url = self.get_property(item, 'url')

        title = self.get_property(item, 'title')

        # Update or create the FeedEvent
        updated_item = {
            'author': author,
            'categories': categories,
            'content': content,
            'description': description,
            'link': link,
            'point': point,
            'publication_date': publication_date,
            'end_date': end_date,
            'image_url': image_url,
            'title': title,
        }

        feed_event, created = FeedEvent.objects.update_or_create(guid=guid, defaults=updated_item)
        if created:
            self.stdout.write('{0}: Added event: "{1}"'.format(str(datetime.utcnow()), guid))

    def delete_expired(self):
        """ Clear events with end_date < now """
        expired_events = FeedEvent.objects.filter(end_date__lt=self.now)
        num_expired_events = len(expired_events)
        if num_expired_events > 0:
            expired_events.delete()
            self.stdout.write('{0}: Cleaned {1} expired events'.format(str(datetime.now()),
                              num_expired_events))
