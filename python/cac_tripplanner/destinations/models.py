from django.contrib.gis.db import models
from django.utils.timezone import now

from ckeditor.fields import RichTextField

from cac_tripplanner.image_utils import generate_image_filename


def generate_filename(instance, filename):
    """Helper for generating image filenames"""
    return generate_image_filename('destinations', instance, filename)


class DestinationManager(models.GeoManager):
    """Custom manager for Destinations that allows filtering on published"""

    def published(self):
        return self.get_queryset().filter(published=True)

class EventManager(DestinationManager):
    """Custom manager for Events that allows filtering on published or currently ongoing"""

    def current(self):
        return self.get_queryset().filter(end_date__gte=now(), start_date__lte=now())

    def upcoming(self):
        return self.get_queryset().filter(start_date__gt=now())


class Destination(models.Model):
    """Represents a destination"""

    class Meta:
        ordering = ['priority', '?']

    name = models.CharField(max_length=50)
    website_url = models.URLField(blank=True, null=True)
    description = RichTextField()
    city = models.CharField(max_length=40, default='Philadelphia')
    state = models.CharField(max_length=20, default='PA')
    zip = models.CharField(max_length=5, null=True)

    # In the admin interface, display the address right above the map, since it triggers geocoding
    address = models.CharField(max_length=40, null=True,
                               help_text=('The map automatically updates as the address is typed, '
                                          'but may be overridden manually if incorrect.'))
    point = models.PointField()
    image = models.ImageField(upload_to=generate_filename, null=True,
                              help_text='The small image. Will be displayed at 310x155.')
    wide_image = models.ImageField(upload_to=generate_filename, null=True,
                                   help_text='The large image. Will be displayed at 680x400.')
    published = models.BooleanField(default=False)
    priority = models.IntegerField(default=9999, null=False)

    objects = DestinationManager()

    def __unicode__(self):
        return self.name

class Event(models.Model):
    """Represents an event, which has a start and end date"""

    class Meta:
        ordering = ['priority', '-start_date']

    name = models.CharField(max_length=50)
    website_url = models.URLField(blank=True, null=True)
    description = RichTextField()
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    destination = models.ForeignKey('Destination', on_delete=models.SET_NULL, null=True, blank=True)

    image = models.ImageField(upload_to=generate_filename, null=True,
                              help_text='The small image. Will be displayed at 310x155.')
    wide_image = models.ImageField(upload_to=generate_filename, null=True,
                                   help_text='The large image. Will be displayed at 680x400.')
    published = models.BooleanField(default=False)
    priority = models.IntegerField(default=9999, null=False)

    objects = EventManager()

    def __unicode__(self):
        return self.name
