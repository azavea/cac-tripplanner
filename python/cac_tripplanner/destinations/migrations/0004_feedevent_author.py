# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0003_feedevent'),
    ]

    operations = [
        migrations.AddField(
            model_name='feedevent',
            name='author',
            field=models.CharField(max_length=64, null=True),
            preserve_default=True,
        ),
    ]
