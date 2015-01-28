from django.contrib.gis.db import models
from ckeditor.fields import RichTextField


class Destination(models.Model):

    name = models.CharField(max_length=50)
    description = RichTextField()
    point = models.PointField()
    address = models.CharField(max_length=40, null=True)
    city = models.CharField(max_length=40)
    state = models.CharField(max_length=20)
    zip = models.CharField(max_length=5, null=True)
    published = models.BooleanField(default=False)

    objects = models.GeoManager()

    def __unicode__(self):
        return self.name
