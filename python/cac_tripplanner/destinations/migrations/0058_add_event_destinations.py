# -*- coding: utf-8 -*-

from django.conf import settings
from django.db import migrations


def add_event_destinations(apps, schema_editor):
    """ Set destinations on sample event to all watershed alliance locations """

    # Only run in development
    if not settings.DEBUG:
        return

    Destination = apps.get_model('destinations', 'Destination')
    Event = apps.get_model('destinations', 'Event')
    EventDestination = apps.get_model('destinations', 'EventDestination')

    try:
        event = Event.objects.get(id=999)
        event.event_destinations.all().delete()
        for wa in Destination.objects.filter(watershed_alliance=True):
            ed = EventDestination(related_event=event, destination=wa)
            ed.save()
    except Event.DoesNotExist:
        return


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0057_default_tours'),
    ]

    operations = [
        migrations.RunPython(add_event_destinations, migrations.RunPython.noop),
    ]
