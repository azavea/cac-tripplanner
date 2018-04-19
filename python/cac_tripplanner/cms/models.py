from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.utils.timezone import now

from ckeditor.fields import RichTextField
from image_cropping import ImageCropField, ImageRatioField

from cac_tripplanner.image_utils import generate_image_filename

ARTICLE_NARROW_IMAGE_DIMENSIONS = (310, 218)
ARTICLE_WIDE_IMAGE_DIMENSIONS = (680, 200)
ARTICLE_NARROW_IMAGE_DIMENSION_STRING = 'x'.join([str(x) for x in ARTICLE_NARROW_IMAGE_DIMENSIONS])
ARTICLE_WIDE_IMAGE_DIMENSION_STRING = 'x'.join([str(x) for x in ARTICLE_WIDE_IMAGE_DIMENSIONS])


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
        return self.published().order_by('?').first()


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
    teaser = RichTextField(config_name='teaser')  # above the fold
    content = RichTextField(null=True, blank=True)  # below the fold
    publish_date = models.DateTimeField(blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    content_type = models.CharField(max_length=4, choices=ArticleTypes.CHOICES)
    wide_image_raw = ImageCropField(upload_to=generate_filename,
                                    null=True,
                                    verbose_name='wide image file',
                                    help_text=settings.IMAGE_CROPPER_HELP_TEXT)
    wide_image = ImageRatioField('wide_image_raw', ARTICLE_WIDE_IMAGE_DIMENSION_STRING,
                                 help_text='The large image. Will be displayed at ' +
                                 ARTICLE_WIDE_IMAGE_DIMENSION_STRING)
    narrow_image_raw = ImageCropField(upload_to=generate_filename,
                                      null=True,
                                      verbose_name='narrow image file',
                                      help_text=settings.IMAGE_CROPPER_HELP_TEXT)
    narrow_image = ImageRatioField('narrow_image', ARTICLE_NARROW_IMAGE_DIMENSION_STRING,
                                   help_text='The small image. Will be displayed at ' +
                                   ARTICLE_NARROW_IMAGE_DIMENSION_STRING)

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
