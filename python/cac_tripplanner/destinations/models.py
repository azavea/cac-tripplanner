from django.contrib.gis.db import models
from django.utils.timezone import now

from ckeditor.fields import RichTextField

from cac_tripplanner.image_utils import generate_image_filename


def generate_filename(instance, filename):
    """Helper for generating image filenames"""
    return generate_image_filename('destinations', instance, filename)


class DestinationManager(models.GeoManager):
    """Custom manager for Destinations allows filtering on published"""

    def published(self):
        return self.get_queryset().filter(published=True)


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


class FeedEventManager(models.GeoManager):
    """Custom manager for FeedEvents allows filtering on publication_date"""

    def published(self):
        return self.get_queryset().filter(publication_date__lt=now()).filter(end_date__gt=now())

    def get_queryset(self):
        return super(FeedEventManager, self).get_queryset()


class FeedEvent(models.Model):
    """ Model for RSS Feed Events, currently served by Uwishunu """

    guid = models.CharField(unique=True, max_length=64)
    title = models.CharField(max_length=512, null=True)
    link = models.CharField(max_length=512, null=True)
    image_url = models.URLField(blank=True, null=True)
    author = models.CharField(max_length=64, null=True)
    publication_date = models.DateTimeField()
    end_date = models.DateTimeField(default=now)
    categories = models.CharField(max_length=512, null=True)
    description = models.CharField(max_length=512, null=True)
    content = RichTextField(blank=True, null=True)
    point = models.PointField()

    @property
    def published(self):
        """Helper property to easily determine if an article is published"""
        if self.publication_date and self.end_date:
            return self.publication_date < now() and self.end_date > now()
        else:
            return False

    def __unicode__(self):
        return self.title

    objects = FeedEventManager()
