# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0016_auto_20150318_1704'),
    ]

    operations = [
        migrations.AddField(
            model_name='destination',
            name='priority',
            field=models.IntegerField(default=9999),
        ),
    ]
