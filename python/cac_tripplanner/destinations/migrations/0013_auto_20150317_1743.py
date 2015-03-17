# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0012_prepopulate_destinations'),
    ]

    operations = [
        migrations.AddField(
            model_name='feedevent',
            name='end_date',
            field=models.DateTimeField(default=django.utils.timezone.now),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='feedevent',
            name='image_url',
            field=models.URLField(null=True, blank=True),
            preserve_default=True,
        ),
    ]
