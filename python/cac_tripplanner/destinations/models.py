from django.contrib.gis.db import models
from django.utils.timezone import now
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
