# -*- coding: utf-8 -*-
# Generated by Django 1.11.12 on 2018-04-12 16:19
from __future__ import unicode_literals

import destinations.models
from django.db import migrations, models
import django.db.models.deletion
import image_cropping.fields


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0035_auto_20180410_1425'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExtraDestinationPicture',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image_raw', image_cropping.fields.ImageCropField(null=True, upload_to=destinations.models.generate_filename, verbose_name=b'image file')),
                ('image', image_cropping.fields.ImageRatioField(b'image_raw', '680x400', adapt_rotation=False, allow_fullsize=False, free_crop=False, help_text=b'Image will be displayed at 680x400.', hide_image_field=False, size_warning=True, verbose_name='image')),
                ('destination', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='destinations.Destination')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='ExtraEventPicture',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image_raw', image_cropping.fields.ImageCropField(null=True, upload_to=destinations.models.generate_filename, verbose_name=b'image file')),
                ('image', image_cropping.fields.ImageRatioField(b'image_raw', '680x400', adapt_rotation=False, allow_fullsize=False, free_crop=False, help_text=b'Image will be displayed at 680x400.', hide_image_field=False, size_warning=True, verbose_name='image')),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='destinations.Event')),
            ],
            options={
                'abstract': False,
            },
        ),
    ]
