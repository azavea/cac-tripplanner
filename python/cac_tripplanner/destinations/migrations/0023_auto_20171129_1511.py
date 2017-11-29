# -*- coding: utf-8 -*-
# Generated by Django 1.11.7 on 2017-11-29 20:11
from __future__ import unicode_literals

import ckeditor.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0022_delete_feedevent'),
    ]

    operations = [
        migrations.CreateModel(
            name='DestinationCategory',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='destination',
            name='categories',
            field=models.ManyToManyField(to='destinations.DestinationCategory'),
        ),
    ]
