import logging

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.db import models
from django.db.models import Count, Manager as GeoManager, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.utils.timezone import now

from ckeditor.fields import RichTextField
from image_cropping import ImageCropField, ImageRatioField

from cac_tripplanner.image_utils import generate_image_filename

NARROW_IMAGE_DIMENSIONS = (310, 155)
WIDE_IMAGE_DIMENSIONS = (680, 400)
NARROW_IMAGE_DIMENSION_STRING = 'x'.join([str(x) for x in NARROW_IMAGE_DIMENSIONS])
WIDE_IMAGE_DIMENSION_STRING = 'x'.join([str(x) for x in WIDE_IMAGE_DIMENSIONS])

logger = logging.getLogger(__name__)


def generate_filename(instance, filename):
    """Helper for generating image filenames."""
    return generate_image_filename('destinations', instance, filename)


class DestinationManager(GeoManager):
    """Custom manager for Destinations that allows filtering on published."""

    def published(self):
        return self.get_queryset().filter(published=True)


class EventManager(DestinationManager):
    """Custom manager for Events that allows filtering on published or currently ongoing."""

    def current(self):
        return self.get_queryset().filter(published=True, end_date__gte=now())

    def upcoming(self):
        return self.get_queryset().filter(published=True, start_date__gt=now())


class DestinationCategory(models.Model):
    """Categories for filtering destinations."""

    class Meta:
        ordering = ['name', ]

    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class Activity(models.Model):
    """Possible things to do at an Attraction."""

    class Meta:
        ordering = ['name', ]

    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class UserFlag(models.Model):
    """Track flags set by mobile app users."""

    class UserFlags(object):
        been = 'been'
        want_to_go = 'want_to_go'
        not_interested = 'not_interested'
        liked = 'liked'
        none = ''

        CHOICES = (
            (been, 'Been'),
            (want_to_go, 'Want to go'),
            (not_interested, 'Not interested'),
            (liked, 'Liked'),
            (none, '')
        )

    # generic foreign key to abstract Attraction model
    # see: https://docs.djangoproject.com/en/1.11/ref/contrib/contenttypes/#generic-relations
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField(null=False, db_index=True)
    attraction = GenericForeignKey('content_type', 'object_id')
    is_event = models.BooleanField(default=False, db_index=True)
    timestamp = models.DateTimeField(default=now, editable=False, db_index=True)
    user_uuid = models.UUIDField(editable=False, db_index=True)
    flag = models.CharField(choices=UserFlags.CHOICES, max_length=32, db_index=True, blank=True)
    historic = models.BooleanField(default=False, db_index=True)

    class Meta:
        indexes = [
            # index generic foreign key, as they aren't by default
            # see https://code.djangoproject.com/ticket/23435
            models.Index(fields=['content_type', 'object_id']),
            # index together for finding most recent flag from a user for attraction
            models.Index(fields=['user_uuid', 'historic', 'object_id', 'is_event']),
        ]

    def __str__(self):
        return "{0} flagged: {1}".format(self.attraction.name, self.flag)


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
    image_raw = ImageCropField(upload_to=generate_filename, verbose_name='image file',
                               help_text=settings.IMAGE_CROPPER_HELP_TEXT)
    wide_image_raw = ImageCropField(upload_to=generate_filename, verbose_name='wide image file',
                                    help_text=settings.IMAGE_CROPPER_HELP_TEXT)
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
    # support filtering user flags by attraction
    user_flags = GenericRelation(UserFlag, related_query_name='flag_attraction')

    def get_image_as_list(self):
        return list(map(int, self.image.split(','))) if self.image else []

    def get_wide_image_as_list(self):
        return list(map(int, self.wide_image.split(','))) if self.wide_image else []

    @property
    def is_event(self):
        """Helper to check which sub-class this Attraction belongs to."""
        return isinstance(self, Event)

    @property
    def is_tour(self):
        return False

    def has_activity(self, activity_name):
        """Helper to check if an activity of a given name is available at a destination."""
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

    def __str__(self):
        return self.name


class Event(Attraction):
    """Represents an event, which has a start and end date."""

    class Meta:
        ordering = ['priority', '-start_date']

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    destinations = models.ManyToManyField('Destination', blank=True)

    objects = EventManager()

    def __str__(self):
        return self.name


class ExtraImage(models.Model):

    class Meta:
        abstract = True

    image_raw = ImageCropField(upload_to=generate_filename, null=False, verbose_name='image file',
                               help_text=settings.IMAGE_CROPPER_HELP_TEXT)
    image = ImageRatioField('image_raw', NARROW_IMAGE_DIMENSION_STRING,
                            help_text='Image will be displayed at ' + NARROW_IMAGE_DIMENSION_STRING)
    wide_image = ImageRatioField('image_raw', WIDE_IMAGE_DIMENSION_STRING,
                                 help_text='Image will be displayed at ' +
                                 WIDE_IMAGE_DIMENSION_STRING)

    def __str__(self):
        return self.image_raw.url if self.image_raw else ''


class ExtraDestinationPicture(ExtraImage):
    destination = models.ForeignKey('Destination', on_delete=models.CASCADE)


class ExtraEventPicture(ExtraImage):
    event = models.ForeignKey('Event', on_delete=models.CASCADE)


def user_flag_summary_manger_factory(manager_for_events=False):
    """Wrap the object manager for user flag summary counts in a factory.

    Allows for easy support of both destinations and events.
    """
    class UserFlagSummaryManager(models.Manager):
        """Annotate queryset of attractions to add user flag count summaries."""

        def get_queryset(self):
            queryset = super(UserFlagSummaryManager, self).get_queryset()
            for flag, label in UserFlag.UserFlags.CHOICES:
                queryset = queryset.annotate(**{flag: Coalesce(Subquery(
                    UserFlag.objects.filter(historic=False, is_event=manager_for_events, flag=flag,
                                            object_id=OuterRef('pk')).values('flag').annotate(
                                                total=Count('pk')).values('total'),
                    output_field=models.IntegerField()), 0)})
            return queryset

    return UserFlagSummaryManager()


class DestinationUserFlags(Destination):
    """Proxy class to annotate destinations with user flag summary data."""

    class Meta:
        proxy = True
        verbose_name = 'Destination User Flag Summary'
        verbose_name_plural = 'Destination User Flags Summary'

    objects = user_flag_summary_manger_factory(False)

    def been(self):
        return self.been
    been.admin_order_field = 'been'

    def want_to_go(self):
        return self.want_to_go
    want_to_go.admin_order_field = 'want_to_go'

    def liked(self):
        return self.liked
    liked.admin_order_field = 'liked'

    def not_interested(self):
        return self.not_interested
    not_interested.admin_order_field = 'not_interested'


class EventUserFlags(Event):
    """Proxy class to annotate events with user flag summary data."""

    class Meta:
        proxy = True
        verbose_name = 'Event User Flag Summary'
        verbose_name_plural = 'Event User Flags Summary'

    objects = user_flag_summary_manger_factory(True)

    def been(self):
        return self.been
    been.admin_order_field = 'been'

    def want_to_go(self):
        return self.want_to_go
    want_to_go.admin_order_field = 'want_to_go'

    def liked(self):
        return self.liked
    liked.admin_order_field = 'liked'

    def not_interested(self):
        return self.not_interested
    not_interested.admin_order_field = 'not_interested'


class TourDestination(models.Model):

    class Meta:
        ordering = ['order', '-start_date']
        unique_together = [['destination', 'related_tour']]

    destination = models.ForeignKey('Destination',
                                    on_delete=models.CASCADE,
                                    related_name='tours')
    related_tour = models.ForeignKey('Tour',
                                     on_delete=models.CASCADE,
                                     related_name='tour_destinations')
    order = models.PositiveIntegerField(default=1, null=False, db_index=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)

    def __unicode__(self):
        if self.destination and self.destination.name and self.order:
            return '{name}, order: {order}'.format(name=self.destination.name,
                                                   order=self.order)
        else:
            return 'Tour Destination'


class Tour(models.Model):

    class Meta:
        ordering = ['priority', '?']

    name = models.CharField(max_length=50, unique=True)
    description = RichTextField(blank=True, null=True)
    priority = models.IntegerField(default=9999, null=False)
    destinations = models.ManyToManyField('TourDestination')
    published = models.BooleanField(default=False)

    objects = DestinationManager()

    @property
    def accessible(self):
        """Returns true if all destinations in this tour are accessible."""
        for td in self.tour_destinations.all():
            if not td.destination.accessible:
                return False
        return True

    @property
    def watershed_alliance(self):
        """Returns true if all destinations in this tour are in the Watershed Alliance."""
        for td in self.tour_destinations.all():
            if not td.destination.watershed_alliance:
                return False
        return True

    @property
    def first_destination(self):
        if self.tour_destinations.count() > 0:
            return self.tour_destinations.order_by('order').first().destination
        return None

    @property
    def is_event(self):
        return False

    @property
    def is_tour(self):
        return True

    def has_activity(self, activity_name):
        """Helper to check if an activity of a given name is available at
        any of this tour's destinations."""
        for td in self.tour_destinations.all():
            if td.destination.activities.filter(name=activity_name).exists():
                return True
        return False

    def __unicode__(self):
        return self.name
