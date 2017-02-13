# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import destinations.models


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0019_auto_20170201_1527'),
    ]

    operations = [
        migrations.AlterField(
            model_name='destination',
            name='image',
            field=models.ImageField(help_text=b'The small image. Will be displayed at 310x155.', null=True, upload_to=destinations.models.generate_filename),
        ),
        migrations.AlterField(
            model_name='destination',
            name='wide_image',
            field=models.ImageField(help_text=b'The large image. Will be displayed at 680x400.', null=True, upload_to=destinations.models.generate_filename),
        ),
    ]
