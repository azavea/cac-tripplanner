# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('shortlinks', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='shortenedlink',
            name='key',
            field=models.CharField(max_length=22, db_index=True),
            preserve_default=True,
        ),
    ]
