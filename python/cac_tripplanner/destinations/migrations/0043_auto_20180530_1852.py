# -*- coding: utf-8 -*-
# Generated by Django 1.11.12 on 2018-05-30 22:52


from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0042_userflag'),
    ]

    operations = [
        migrations.CreateModel(
            name='DestinationUserFlags',
            fields=[
            ],
            options={
                'verbose_name': 'Destination User Flag Summary',
                'proxy': True,
                'verbose_name_plural': 'Destination User Flags Summary',
                'indexes': [],
            },
            bases=('destinations.destination',),
        ),
        migrations.CreateModel(
            name='EventUserFlags',
            fields=[
            ],
            options={
                'verbose_name': 'Event User Flag Summary',
                'proxy': True,
                'verbose_name_plural': 'Event User Flags Summary',
                'indexes': [],
            },
            bases=('destinations.event',),
        ),
        migrations.AddField(
            model_name='userflag',
            name='historic',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AlterField(
            model_name='userflag',
            name='flag',
            field=models.CharField(choices=[('been', 'Been'), ('want_to_go', 'Want to go'), ('not_interested', 'Not interested'), ('liked', 'Liked'), ('', '')], db_index=True, max_length=32),
        ),
        migrations.AlterField(
            model_name='userflag',
            name='is_event',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AlterField(
            model_name='userflag',
            name='object_id',
            field=models.PositiveIntegerField(db_index=True),
        ),
        migrations.AlterField(
            model_name='userflag',
            name='timestamp',
            field=models.DateTimeField(db_index=True, default=django.utils.timezone.now, editable=False),
        ),
        migrations.AlterField(
            model_name='userflag',
            name='user_uuid',
            field=models.UUIDField(db_index=True, editable=False),
        ),
        migrations.AddIndex(
            model_name='userflag',
            index=models.Index(fields=['content_type', 'object_id'], name='destination_content_47552e_idx'),
        ),
        migrations.AddIndex(
            model_name='userflag',
            index=models.Index(fields=['user_uuid', 'historic', 'object_id', 'is_event'], name='destination_user_uu_1b1e60_idx'),
        ),
    ]
