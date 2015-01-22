from django.db import models
from django.contrib.auth.models import User
from ckeditor.fields import RichTextField


class Article(models.Model):

    class ArticleTypes(object):
        community_profile = 'prof'
        tips_and_tricks = 'tips'

        CHOICES = (
            (community_profile, 'Community Profile'),
            (tips_and_tricks, 'Tips and Tricks'),
        )

    title = models.CharField(max_length=80)
    slug = models.SlugField()
    author = models.ForeignKey(User)
    teaser = RichTextField()  # above the fold
    content = RichTextField(null=True, blank=True)  # below the fold
    publish_date = models.DateTimeField(blank=True, null=True)
    published = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    content_type = models.CharField(max_length=4, choices=ArticleTypes.CHOICES)

    def __unicode__(self):
        return self.title
