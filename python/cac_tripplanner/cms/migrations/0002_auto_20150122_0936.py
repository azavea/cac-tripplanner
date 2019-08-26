# -*- coding: utf-8 -*-


from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='article',
            name='content_type',
            field=models.CharField(default='prof', max_length=4, choices=[(b'prof', b'Community Profile'), (b'tips', b'Tips and Tricks')]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='article',
            name='publish_date',
            field=models.DateTimeField(null=True, blank=True),
            preserve_default=True,
        ),
    ]
