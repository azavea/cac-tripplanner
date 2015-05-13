# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('shortlinks', '0002_auto_20150507_1413'),
    ]

    operations = [
        migrations.AlterField(
            model_name='shortenedlink',
            name='key',
            field=models.CharField(max_length=30, db_index=True),
            preserve_default=True,
        ),
    ]
