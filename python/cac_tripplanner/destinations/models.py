from django.contrib.gis.db import models
from django.utils.timezone import now
from ckeditor.fields import RichTextField
import os
import uuid


def generate_filename(instance, filename):
    """ Helper for creating unique filenames

    Must be outside the Destination class because makemigrations throws the following error if not:
        ValueError: Could not find function generate_filename in destinations.models.
        Please note that due to Python 2 limitations, you cannot serialize unbound method functions
        (e.g. a method declared and used in the same class body). Please move the function into the
        main module body to use migrations. For more information, see
        https://docs.djangoproject.com/en/1.7/topics/migrations/#serializing-values

    Also cannot be a class method of Destination because the function signature must exactly match:
    https://docs.djangoproject.com/en/1.7/ref/models/fields/#django.db.models.FileField.upload_to

    """
    _, ext = os.path.splitext(filename)
    return 'destinations/{0}{1}'.format(uuid.uuid4().hex, ext)


class DestinationManager(models.GeoManager):
    """Custom manager for Destinations allows filtering on published"""

    def published(self):
        return self.get_queryset().filter(published=True)

    def get_queryset(self):
        return super(DestinationManager, self).get_queryset()


class Destination(models.Model):
    """Represents a destination"""

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
                              help_text='The full-size image. Will be displayed at 400x400.')
    wide_image = models.ImageField(upload_to=generate_filename, null=True,
                                   help_text='The half-height image. Will be displayed at 400x200.')
    published = models.BooleanField(default=False)

    objects = DestinationManager()

    def __unicode__(self):
        return self.name


class FeedEventManager(models.GeoManager):
    """Custom manager for FeedEvents allows filtering on publication_date"""

    def published(self):
        return self.get_queryset().filter(publication_date__lt=now())

    def get_queryset(self):
        return super(FeedEventManager, self).get_queryset()


class FeedEvent(models.Model):
    """ Model for RSS Feed Events, currently served by Uwishunu """

    guid = models.CharField(unique=True, max_length=64)
    title = models.CharField(max_length=512, null=True)
    link = models.CharField(max_length=512, null=True)
    author = models.CharField(max_length=64, null=True)
    publication_date = models.DateTimeField()
    categories = models.CharField(max_length=512, null=True)
    description = models.CharField(max_length=512, null=True)
    content = RichTextField()
    point = models.PointField()

    @property
    def published(self):
        """Helper property to easily determine if an article is published"""
        if self.publication_date:
            return self.publication_date < now()
        else:
            return False

    def __unicode__(self):
        return self.title

    objects = FeedEventManager()
