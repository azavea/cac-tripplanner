# -*- coding: utf-8 -*-


from django.db import models, migrations
import ckeditor.fields
import django.contrib.gis.db.models.fields


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0002_destination_image'),
    ]

    operations = [
        migrations.CreateModel(
            name='FeedEvent',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('guid', models.CharField(unique=True, max_length=64)),
                ('title', models.CharField(max_length=512, null=True)),
                ('link', models.CharField(max_length=512, null=True)),
                ('publication_date', models.DateTimeField()),
                ('categories', models.CharField(max_length=512, null=True)),
                ('description', models.CharField(max_length=512, null=True)),
                ('content', ckeditor.fields.RichTextField()),
                ('point', django.contrib.gis.db.models.fields.PointField(srid=4326)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
    ]
