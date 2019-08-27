# -*- coding: utf-8 -*-


from django.db import migrations


def get_watershed_alliance_locations():
    """Names of default destinations added in migration 0012 in the Watershed Alliance

    All of them are in the watershed alliance: https://www.watershedalliance.org/centers/
    """
    return [
        'Bartram\'s Garden',
        'Fairmount Waterworks Interpretive Center',
        'Independence Seaport Museum',
        'John Heinz National Wildlife Refuge',
        'NJ Academy of Aquatic Sciences',
        'Palmyra Cove Nature Park',
        'Schuylkill Environmental Education Center',
        'Schuylkill River Greenway Association',
        'Tulpehaking Nature Center at Abbott Marshland',
    ]

def set_watershed_alliance(apps, schema_editor):
    Destination = apps.get_model('destinations', 'Destination')

    # set the watershed alliance flag on the default destinations that were added in migration 0012
    for dest in get_watershed_alliance_locations():
        try:
            destination = Destination.objects.get(name=dest)
        except Destination.DoesNotExist:
            continue
        destination.watershed_alliance = True
        destination.save()


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0029_destination_watershed_alliance'),
    ]

    operations = [
        migrations.RunPython(set_watershed_alliance, migrations.RunPython.noop),
    ]
