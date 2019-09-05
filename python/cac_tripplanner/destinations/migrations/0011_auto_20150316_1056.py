# -*- coding: utf-8 -*-


from django.db import models, migrations
import destinations.models


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0010_default_wide_image'),
    ]

    operations = [
        migrations.AlterField(
            model_name='destination',
            name='image',
            field=models.ImageField(help_text=b'The full-size image. Will be displayed at 400x400.', null=True, upload_to=destinations.models.generate_filename),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='destination',
            name='wide_image',
            field=models.ImageField(help_text=b'The half-height image. Will be displayed at 400x200.', null=True, upload_to=destinations.models.generate_filename),
            preserve_default=True,
        ),
    ]
