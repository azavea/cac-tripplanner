# -*- coding: utf-8 -*-
# Generated by Django 1.11.12 on 2018-04-18 15:03


import cms.models
from django.db import migrations
import image_cropping.fields


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0012_auto_20180412_1617'),
    ]

    operations = [
        migrations.AlterField(
            model_name='article',
            name='narrow_image_raw',
            field=image_cropping.fields.ImageCropField(help_text=b'Save and return to editing this record to see an uploaded image and\nto change how the image is cropped.', null=True, upload_to=cms.models.generate_filename, verbose_name=b'narrow image file'),
        ),
        migrations.AlterField(
            model_name='article',
            name='wide_image_raw',
            field=image_cropping.fields.ImageCropField(help_text=b'Save and return to editing this record to see an uploaded image and\nto change how the image is cropped.', null=True, upload_to=cms.models.generate_filename, verbose_name=b'wide image file'),
        ),
    ]
