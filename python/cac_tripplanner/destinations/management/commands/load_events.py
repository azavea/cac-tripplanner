from datetime import datetime
import urllib2
from xml.dom import minidom

from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from destinations.models import FeedEvent

from pytz import timezone


class Command(BaseCommand):
    args = ''
    help = 'Load the current Uwishunu feed into the FeedEvent table'

    def property_exists(self, item, property_name):
        """ Check if a property exists as a child of the given element """
        return item.getElementsByTagName(property_name).length > 0

    def get_property(self, item, property_name):
        """ Retrieve the value of an xml property name from another xml element """
        elements = item.getElementsByTagName(property_name)
        if elements.length == 0:
            return None
        return elements[0].firstChild.data

    def handle(self, *args, **options):
        """ Retrieve and populate FeedEvent table from an RSS Feed """

        url = 'http://www.uwishunu.com/category/events/feed/'
        # Get 403 forbidden without changing user-agent
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux i686; rv:10.0) Gecko/20100101 Firefox/10.0'
        }
        request = urllib2.Request(url, None, headers)
        feed = minidom.parse(urllib2.urlopen(request))

        for item in feed.getElementsByTagName('item'):
            self.handle_feed_item(item)

    def handle_feed_item(self, item):
        """ Update or create a FeedEvent based on a unique identifier """

        eastern = timezone('US/Eastern')

        # Unique field
        guid = self.get_property(item, 'guid')

        # need a lat/lng to care about this item
        if not (self.property_exists(item, 'geo:lat') and self.property_exists(item, 'geo:long')):
            return

        # Other fields
        author = self.get_property(item, 'dc:creator')

        categories_list = [cat.firstChild.data for cat in item.getElementsByTagName('category')]
        categories = ','.join(categories_list)

        content = self.get_property(item, 'content:encoded')

        description = self.get_property(item, 'description')

        link = self.get_property(item, 'link')

        try:
            lat = float(self.get_property(item, 'geo:lat'))
            lon = float(self.get_property(item, 'geo:long'))
        except ValueError:
            self.stdout.write('Unable to convert lat/lng for: {0}'.format(guid))
            return

        point = Point(lon, lat)

        pubdate = self.get_property(item, 'pubDate')
        publication_date = datetime.strptime(pubdate, '%a, %d %b %Y %H:%M:%S +0000')
        publication_date = eastern.localize(publication_date)

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
            'title': title,
        }

        feed_event, created = FeedEvent.objects.update_or_create(guid=guid, defaults=updated_item)
        if created:
            self.stdout.write('{0}: Added event: "{1}"'.format(str(datetime.utcnow()), guid))
