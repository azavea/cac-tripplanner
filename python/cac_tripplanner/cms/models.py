from django.db import models
from django.contrib.auth.models import User
from ckeditor.fields import RichTextField


class Article(models.Model):

    title = models.CharField(max_length=80)
    slug = models.SlugField()
    author = models.ForeignKey(User)
    teaser = RichTextField()  # above the fold
    content = RichTextField(null=True, blank=True)  # below the fold
    published = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    def __unicode__(self):
        return self.title
