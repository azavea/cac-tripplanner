# -*- coding: utf-8 -*-
# Generated by Django 1.11.23 on 2019-08-30 17:19
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0050_auto_20190830_1129'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='tour',
            options={'ordering': ['priority', '?']},
        ),
        migrations.AddField(
            model_name='tour',
            name='priority',
            field=models.IntegerField(default=9999),
        ),
    ]
