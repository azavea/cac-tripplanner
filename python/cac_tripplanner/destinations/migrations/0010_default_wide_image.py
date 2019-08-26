# -*- coding: utf-8 -*-


from django.db import models, migrations


# Defaults the wide_image to the image
def default_wide_image(apps, schema_editor):
    Destination = apps.get_model("destinations", "Destination")
    for destination in Destination.objects.all():
        destination.wide_image = destination.image
        destination.save()

class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0009_destination_wide_image'),
    ]

    operations = [
        migrations.RunPython(default_wide_image)
    ]
