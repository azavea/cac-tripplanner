# -*- coding: utf-8 -*-

import os
import re
from shutil import copytree, rmtree

from django.conf import settings
from django.db import models, migrations

ALPHANUMERIC_ONLY = re.compile('\W+')
DEST_DIRECTORY = os.path.join(settings.MEDIA_ROOT, settings.DEFAULT_MEDIA_PATH)

def get_image_path(isHalfHeight, locationName):
    """ Create image path, use alphanumeric name of the destination as the image filename """
    height_dir = 'half-square' if isHalfHeight else 'square'
    filename = ALPHANUMERIC_ONLY.sub('', locationName) + '.jpg'
    return os.path.join(settings.DEFAULT_MEDIA_PATH, height_dir, filename)

def get_sample_destinations():
    """ get sample destinations with image filepaths properly set """
    # Oops, how do I get this list from the other migration 0012?
    destinations = [
        {
            'name': 'Fairmount Waterworks Interpretive Center',
        },
        {
            'name': 'Independence Seaport Museum',
        },
        {
            'name': 'Bartram\'s Garden',
        },
        {
            'name': 'Schuylkill Environmental Education Center',
        },
        {
            'name': 'John Heinz National Wildlife Refuge',
        },
        {
            'name': 'NJ Academy of Aquatic Sciences',
        },
        {
            'name': 'Schuylkill River Greenway Association',
        },
        {
            'name': 'Palmyra Cove Nature Park',
        },
        {
            'name': 'Tulpehaking Nature Center at Abbott Marshland',
        },
    ]
    for d in destinations:
        d['image'] = get_image_path(False, d['name'])
        d['wide_image'] = get_image_path(True, d['name'])
    return destinations

def copy_default_images():
    """ Copy images to proper media dir """
    try:
        copytree(settings.DEFAULT_MEDIA_SRC_PATH, DEST_DIRECTORY)
    except OSError as e:
        # file exists error, rmtree is dumb and we can only copy to an empty directory
        if e.errno != 17:
            raise


def add_sample_images(apps, schema_editor):
    """ Add sample images to default destinations, and copy the images to the media dir """

    copy_default_images()

    Destination = apps.get_model('destinations', 'Destination')
    for destination in get_sample_destinations():
        sample_dests = Destination.objects.filter(name=destination['name'])
        for sample_dest in sample_dests:
            sample_dest.image = destination['image']
            sample_dest.wide_image = destination['wide_image']
            sample_dest.save()


def delete_sample_images(apps, schema_editor):
    """ Reset default destination images to None and delete default image dir """
    Destination = apps.get_model('destinations', 'Destination')
    for destination in get_sample_destinations():
        try:
            sample_dests = Destination.objects.filter(name=destination['name'])
            for sample_dest in sample_dests:
                sample_dest.wide_image = None
                sample_dest.image = None
                sample_dest.save()
        except Destination.DoesNotExist:
            pass

    # last delete the images in the media dir
    rmtree(DEST_DIRECTORY, True)


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0015_auto_20150317_1806'),
    ]

    operations = [
        migrations.RunPython(add_sample_images, delete_sample_images),
    ]
