from django.db import models
from django.contrib.auth.models import User
from django.utils.timezone import now

from ckeditor.fields import RichTextField

from cac_tripplanner.settings import MEDIA_URL
from cac_tripplanner.image_utils import generate_image_filename


def generate_filename(instance, filename):
    """Helper for generating image filenames"""
    return generate_image_filename('cms', instance, filename)


class AboutFaqManager(models.Manager):

    def published(self):
        return self.get_queryset().filter(publish_date__lt=now())


class ArticleManager(models.Manager):

    def published(self):
        return self.get_queryset().filter(publish_date__lt=now())

    def random(self):
        """Returns a randomized article"""
        # Need to use the full object, because there is a magic transformation of the URL
        # at some point which is needed for assembling the s3 url.
        randomized = self.published().order_by('?')[:1]

        if randomized:
            return randomized[0]
        else:
            None


class CommunityProfileManager(ArticleManager):
    """Custom manager to get only community profiles"""

    def get_queryset(self):
        return super(CommunityProfileManager, self).get_queryset().filter(content_type='prof')


class TipsAndTricksManager(ArticleManager):
    """Custom manager to get only tips and tricks"""

    def get_queryset(self):
        return super(TipsAndTricksManager, self).get_queryset().filter(content_type='tips')


class AboutFaq(models.Model):
    """User-editable About and FAQ pages"""
    title = models.CharField(max_length=80)
    slug = models.SlugField()
    author = models.ForeignKey(User)
    content = RichTextField(null=True, blank=True)
    publish_date = models.DateTimeField(blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    # Managers
    objects = AboutFaqManager()

    @property
    def published(self):
        """About and FAQ pages are always published"""
        return True

    def __unicode__(self):
        return self.title


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
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    content_type = models.CharField(max_length=4, choices=ArticleTypes.CHOICES)
    wide_image = models.ImageField(upload_to=generate_filename, null=True,
                                   help_text='The wide image. Will be displayed at 1440x400.')
    narrow_image = models.ImageField(upload_to=generate_filename, null=True,
                                     help_text='The narrow image. Will be displayed at 400x600.')

    @property
    def published(self):
        """Helper property to easily determine if an article is published"""
        if self.publish_date:
            return (self.publish_date < now())
        else:
            return False

    # Managers
    objects = ArticleManager()
    profiles = CommunityProfileManager()
    tips = TipsAndTricksManager()

    def __unicode__(self):
        return self.title
