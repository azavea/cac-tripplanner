# -*- coding: utf-8 -*-


from django.db import migrations


def get_sample_activities():
    return [
        {
            'name': 'cycling',
        },
        {
            'name': 'hiking',
        },
        {
            'name': 'canoeing',
        },
    ]

def get_sample_destinations():
    """Names of default destinations added in migration 0012, with default activities to add"""
    return [
        {
            'name': 'Fairmount Waterworks Interpretive Center',
            'activities': ()
        },
        {
            'name': 'Independence Seaport Museum',
            'activities': ()
        },
        {
            'name': 'Bartram\'s Garden',
            'activities': ('cycling', 'hiking',)
        },
        {
            'name': 'Schuylkill Environmental Education Center',
            'activities': ('canoeing',)
        },
        {
            'name': 'John Heinz National Wildlife Refuge',
            'activities': ('hiking',)
        },
        {
            'name': 'NJ Academy of Aquatic Sciences',
            'activities': ()
        },
        {
            'name': 'Schuylkill River Greenway Association',
            'activities': ()
        },
        {
            'name': 'Palmyra Cove Nature Park',
            'activities': ('hiking',)
        },
        {
            'name': 'Tulpehaking Nature Center at Abbott Marshland',
            'activities': ()
        },
    ]

def add_sample_activities(apps, schema_editor):
    Activity = apps.get_model('destinations', 'Activity')
    Destination = apps.get_model('destinations', 'Destination')
    # If activities already exist, do nothing
    if Activity.objects.count() > 0:
        return

    for activity in get_sample_activities():
        sample_activities = Activity.objects.filter(name=activity['name'])
        if len(sample_activities) == 0:
            sample_dest = Activity(**activity)
            sample_dest.save()

    # set the new activities on the default destinations that were added in migration 0012
    for dest in get_sample_destinations():
        try:
            destination = Destination.objects.get(name=dest['name'])
        except Destination.DoesNotExist:
            continue
        for add_activity in dest['activities']:
            try:
                activity = Activity.objects.get(name=add_activity)
                destination.activities.add(activity)
            except Activity.DoesNotExist:
                continue


def delete_sample_activities(apps, schema_editor):
    Activity = apps.get_model('destinations', 'Activity')
    for activity in get_sample_activities():
        try:
            sample_activities = Activity.objects.filter(name=activity['name'])
            sample_activities.delete()
        except Activity.DoesNotExist:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0027_auto_20171201_1439'),
    ]

    operations = [
        migrations.RunPython(add_sample_activities, delete_sample_activities),
    ]
