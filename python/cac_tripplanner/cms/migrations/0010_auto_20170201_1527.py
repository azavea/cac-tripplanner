# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import cms.models


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0009_auto_20150515_1248'),
    ]

    operations = [
        migrations.AlterField(
            model_name='article',
            name='narrow_image',
            field=models.ImageField(help_text=b'The small image. Will be displayed at 310x218.', null=True, upload_to=cms.models.generate_filename),
        ),
        migrations.AlterField(
            model_name='article',
            name='wide_image',
            field=models.ImageField(help_text=b'The large image. Will be displayed at 680x200.', null=True, upload_to=cms.models.generate_filename),
        ),
    ]
