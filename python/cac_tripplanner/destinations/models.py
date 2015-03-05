from django.contrib.gis.db import models
from ckeditor.fields import RichTextField

class DestinationManager(models.GeoManager):
    """Custom manager for Destinations allows filtering on published"""

    def published(self):
        return self.get_queryset().filter(published=True)

    def get_queryset(self):
        return super(DestinationManager, self).get_queryset()


class Destination(models.Model):

    name = models.CharField(max_length=50)
    description = RichTextField()
    point = models.PointField()
    address = models.CharField(max_length=40, null=True)
    city = models.CharField(max_length=40)
    state = models.CharField(max_length=20)
    zip = models.CharField(max_length=5, null=True)
    image = models.ImageField(upload_to='destinations/', null=True)
    published = models.BooleanField(default=False)

    objects = DestinationManager()

    def __unicode__(self):
        return self.name


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

    objects = models.GeoManager()
