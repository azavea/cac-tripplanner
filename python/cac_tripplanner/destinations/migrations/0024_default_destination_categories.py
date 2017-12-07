# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations


def get_sample_categories():
    return [
        {
            'name': 'Nature',
        },
        {
            'name': 'Exercise',
        },
        {
            'name': 'Relax',
        },
        {
            'name': 'Educational',
        },
    ]

def get_sample_destinations():
    """Names of default destinations added in migration 0012, with default categories to add"""
    return [
        {
            'name': 'Fairmount Waterworks Interpretive Center',
            'categories': ('Nature', 'Educational',)
        },
        {
            'name': 'Independence Seaport Museum',
            'categories': ('Educational',)
        },
        {
            'name': 'Bartram\'s Garden',
            'categories': ('Nature', 'Relax', 'Exercise')
        },
        {
            'name': 'Schuylkill Environmental Education Center',
            'categories': ('Nature', 'Educational',)
        },
        {
            'name': 'John Heinz National Wildlife Refuge',
            'categories': ('Nature', 'Relax',)
        },
        {
            'name': 'NJ Academy of Aquatic Sciences',
            'categories': ('Educational',)
        },
        {
            'name': 'Schuylkill River Greenway Association',
            'categories': ('Nature', 'Exercise',)
        },
        {
            'name': 'Palmyra Cove Nature Park',
            'categories': ('Nature', 'Exercise',)
        },
        {
            'name': 'Tulpehaking Nature Center at Abbott Marshland',
            'categories': ('Nature', 'Educational',)
        },
    ]

def add_sample_categories(apps, schema_editor):
    DestinationCategory = apps.get_model('destinations', 'DestinationCategory')
    Destination = apps.get_model('destinations', 'Destination')
    # If categories already exist, do nothing
    if DestinationCategory.objects.count() > 0:
        return

    for category in get_sample_categories():
        sample_categories = DestinationCategory.objects.filter(name=category['name'])
        if len(sample_categories) == 0:
            sample_dest = DestinationCategory(**category)
            sample_dest.save()

    # set the new categories on the default destinations that were added in migration 0012
    for dest in get_sample_destinations():
        try:
            destination = Destination.objects.get(name=dest['name'])
        except Destination.DoesNotExist:
            continue
        for add_category in dest['categories']:
            try:
                category = DestinationCategory.objects.get(name=add_category)
            except DestinationCategory.DoesNotExist:
                continue
            destination.categories.add(category)


def delete_sample_categories(apps, schema_editor):
    DestinationCategory = apps.get_model('destinations', 'DestinationCategory')
    for category in get_sample_categories():
        try:
            sample_categories = DestinationCategory.objects.filter(name=category['name'])
            sample_categories.delete()
        except DestinationCategory.DoesNotExist:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0023_auto_20171129_1511'),
    ]

    operations = [
        migrations.RunPython(add_sample_categories, delete_sample_categories),
    ]
