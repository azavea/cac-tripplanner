# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import ckeditor.fields


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0014_auto_20150317_1805'),
    ]

    operations = [
        migrations.AlterField(
            model_name='feedevent',
            name='content',
            field=ckeditor.fields.RichTextField(null=True, blank=True),
            preserve_default=True,
        ),
    ]
