# -*- coding: utf-8 -*-
# Generated by Django 1.11.21 on 2019-07-16 15:40


from datetime import datetime
import os
import re
from shutil import copytree

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models, migrations


ALPHANUMERIC_ONLY = re.compile('\W+')
DEST_DIRECTORY = os.path.join(settings.MEDIA_ROOT, settings.DEFAULT_MEDIA_PATH)


def get_image_path(half_height, location_name):
    """ Create image path, use alphanumeric name of the destination as the image filename """
    height_dir = 'half-square' if half_height else 'square'
    filename = ALPHANUMERIC_ONLY.sub('', location_name) + '.jpg'
    return os.path.join(settings.DEFAULT_MEDIA_PATH, height_dir, filename)


def get_sample_articles():
    articles = [
        {
            'title': 'Video Trip to Palmyra Cove',
            'slug': 'video-trip-to-palmyra-cove',
            'content_type': 'prof',
            'publish_date': datetime.now(),
            'teaser': 'GoPhillyGo student ambassadors, Tykee James and Stephanie Mason, used GoPhillyGo.org to plan a trip to one of our featured destinations, Palmyra Cove Nature Park.',
            'content': '<p>GoPhillyGo student ambassadors, Tykee James and Stephanie Mason, used GoPhillyGo.org to plan a trip to one of our featured destinations, Palmyra Cove Nature Park. Tykee and Stephanie began their journey on bike at City Hall in Philadelphia,&nbsp;traveled over the Benjamin Franklin Bridge, hopped on the NJ River Line, and&nbsp;arrived at Palmyra Cove Nature Park in Palmyra, NJ. Aside from the beautiful views along the shoreline, <a href="http://www.palmyracove.org/" target="_blank">Palmyra Cove</a>&nbsp;is&nbsp;a 250-acre urban oasis along&nbsp;the Delaware River. Visit today to see&nbsp;wetlands, woodlands, meadows, wild creek, and a freshwater Tidal Cove.&nbsp;</p><p>&nbsp;</p><h3>Plan a trip today and #GoPhillyGo!</h3>',
        },
    ]
    for article in articles:
        narrow = get_image_path(False, article['title'])
        wide = get_image_path(True, article['title'])
        article['narrow_image_raw'] = narrow
        article['wide_image_raw'] = wide
    return articles


def copy_default_images():
    """ Copy images to proper media dir """
    try:
        copytree(settings.DEFAULT_MEDIA_SRC_PATH, DEST_DIRECTORY)
    except OSError as e:
        # file exists error, rmtree is dumb and we can only copy to an empty directory
        if e.errno != 17:
            raise


def add_sample_articles(apps, schema_editor):
    """ Add sample articles, and copy the images to the media dir """

    # Only run in development
    if not settings.DEBUG:
        return

    copy_default_images()

    admin = User.objects.get(username='admin')

    Article = apps.get_model('CMS', 'Article')
    for article in get_sample_articles():
        article['author_id'] = admin.id
        sample_article = Article(**article)
        sample_article.save()


def delete_sample_articles(apps, schema_editor):
    """ Delete default articles """

    # Only run in development
    if not settings.DEBUG:
        return

    Article = apps.get_model('CMS', 'Article')
    for article in get_sample_articles():
        try:
            sample_articles = Article.objects.filter(title=article['title'])
            sample_articles.delete()
        except Article.DoesNotExist:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0014_auto_20180601_1121'),
    ]

    operations = [
        migrations.RunPython(add_sample_articles, delete_sample_articles),
    ]
