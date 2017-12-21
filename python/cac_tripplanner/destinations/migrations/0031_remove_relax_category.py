# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import IntegrityError, migrations


def add_relax_category(apps, schema_editor):
    """On migration reverse, add relax category back"""
    DestinationCategory = apps.get_model('destinations', 'DestinationCategory')

    try:
        relax = DestinationCategory.objects.create(name='Relax')
        relax.save()
    except IntegrityError as ex:
        print(ex)  # handle case relax category already exists


def delete_relax_category(apps, schema_editor):
    """Remove 'relax' destination category from database"""
    DestinationCategory = apps.get_model('destinations', 'DestinationCategory')

    try:
        relax = DestinationCategory.objects.get(name='Relax')
        relax.delete()
    except DestinationCategory.DoesNotExist:
        return


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0030_default_watershed_alliance'),
    ]

    operations = [
        migrations.RunPython(delete_relax_category, add_relax_category),
    ]
