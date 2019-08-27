# -*- coding: utf-8 -*-


from django.db import migrations


def rename_activity(apps, from_name, to_name):
    """Helper to rename an Activity"""
    Activity = apps.get_model('destinations', 'Activity')

    try:
        activity = Activity.objects.get(name=from_name)
        activity.name = to_name
        activity.save()
    except Activity.DoesNotExist:
        # in case activity to rename does not exist, do nothing
        return


def rename_canoeing_activity_to_water_recreation(apps, schema_editor):
    """Forewards migration; rename 'canoeing' Activity to 'water recreation'"""
    rename_activity(apps, 'canoeing', 'water recreation')


def rename_water_recreation_activity_to_canoeing(apps, schema_editor):
    """"Backwards migration; rename 'water recreation' Activity to 'canoeing'"""
    rename_activity(apps, 'water recreation', 'canoeing')


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0033_auto_20171221_1625'),
    ]

    operations = [
        migrations.RunPython(rename_canoeing_activity_to_water_recreation,
                             rename_water_recreation_activity_to_canoeing),
    ]
