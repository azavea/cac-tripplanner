from django.contrib.gis.db import models
from django.utils.timezone import now

from ckeditor.fields import RichTextField
from image_cropping import ImageCropField, ImageRatioField

from cac_tripplanner.image_utils import generate_image_filename

NARROW_IMAGE_DIMENSIONS = (310, 155)
WIDE_IMAGE_DIMENSIONS = (680, 400)
NARROW_IMAGE_DIMENSION_STRING = 'x'.join([str(x) for x in NARROW_IMAGE_DIMENSIONS])
WIDE_IMAGE_DIMENSION_STRING = 'x'.join([str(x) for x in WIDE_IMAGE_DIMENSIONS])


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
        return self.get_queryset().filter(published=True, end_date__gte=now())

    def upcoming(self):
        return self.get_queryset().filter(published=True, start_date__gt=now())


class DestinationCategory(models.Model):
    """Categories for filtering destinations"""

    class Meta:
        ordering = ['name', ]

    name = models.CharField(max_length=50, unique=True)

    def __unicode__(self):
        return self.name


class Activity(models.Model):
    """Possible things to do at an Attraction"""

    class Meta:
        ordering = ['name', ]

    name = models.CharField(max_length=50, unique=True)

    def __unicode__(self):
        return self.name


class Attraction(models.Model):
    """Shared properties of destinations and events.

    Note: for destination field to appear in admin interface, must also be defined on `fields`
    in `admin.py`.
    """

    class Meta:
        abstract = True

    name = models.CharField(max_length=50)
    website_url = models.URLField(blank=True, null=True)
    description = RichTextField()
    image_raw = ImageCropField(upload_to=generate_filename, verbose_name='image file')
    wide_image_raw = ImageCropField(upload_to=generate_filename, verbose_name='wide image file')
    image = ImageRatioField('image_raw', NARROW_IMAGE_DIMENSION_STRING,
                            help_text='The small image. Will be displayed at ' +
                                      NARROW_IMAGE_DIMENSION_STRING)
    wide_image = ImageRatioField('wide_image_raw', WIDE_IMAGE_DIMENSION_STRING,
                                 help_text='The large image. Will be displayed at ' +
                                           WIDE_IMAGE_DIMENSION_STRING)
    published = models.BooleanField(default=False)
    priority = models.IntegerField(default=9999, null=False)
    accessible = models.BooleanField(default=False, help_text='Is it ADA accessible?')
    activities = models.ManyToManyField('Activity', blank=True)

    def get_image_as_list(self):
        return list(map(int, self.image.split(','))) if self.image else []

    def get_wide_image_as_list(self):
        return list(map(int, self.wide_image.split(','))) if self.wide_image else []

    @property
    def is_event(self):
        """Helper to check which sub-class this Attraction belongs to"""
        return isinstance(self, Event)

    def has_activity(self, activity_name):
        """Helper to check if an activity of a given name is available at a destination"""
        return self.activities.filter(name=activity_name).exists()


class Destination(Attraction):
    """Represents a destination.

    Note: for field to appear in admin interface, must also be defined on `fields` in `admin.py`.
    """

    class Meta:
        ordering = ['priority', '?']

    city = models.CharField(max_length=40, default='Philadelphia')
    state = models.CharField(max_length=20, default='PA')
    zipcode = models.CharField(max_length=5, null=True)

    # In the admin interface, display the address right above the map, since it triggers geocoding
    address = models.CharField(max_length=40, null=True,
                               help_text=('The map automatically updates as the address is typed, '
                                          'but may be overridden manually if incorrect.'))
    point = models.PointField()
    categories = models.ManyToManyField('DestinationCategory', blank=True)
    watershed_alliance = models.BooleanField(default=False, help_text="""
        Does this location belong to the <a target="_blank"
        href="https://www.watershedalliance.org/centers/">
        Alliance for Watershed Education</a>?""")

    objects = DestinationManager()

    def __unicode__(self):
        return self.name

class Event(Attraction):
    """Represents an event, which has a start and end date"""

    class Meta:
        ordering = ['priority', '-start_date']

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    destination = models.ForeignKey('Destination', on_delete=models.SET_NULL, null=True, blank=True)

    objects = EventManager()

    def __unicode__(self):
        return self.name


class ExtraImage(models.Model):

    class Meta:
        abstract = True

    image_raw = ImageCropField(upload_to=generate_filename, null=False, verbose_name='image file')
    image = ImageRatioField('image_raw', NARROW_IMAGE_DIMENSION_STRING,
                            help_text='Image will be displayed at ' + NARROW_IMAGE_DIMENSION_STRING)
    wide_image = ImageRatioField('image_raw', WIDE_IMAGE_DIMENSION_STRING,
                                 help_text='Image will be displayed at ' +
                                 WIDE_IMAGE_DIMENSION_STRING)

    def __unicode__(self):
        return self.image_raw.url if self.image_raw else ''


class ExtraDestinationPicture(ExtraImage):
    destination = models.ForeignKey('Destination')


class ExtraEventPicture(ExtraImage):
    event = models.ForeignKey('Event')
