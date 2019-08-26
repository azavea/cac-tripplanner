# -*- coding: utf-8 -*-


from django.db import models, migrations
import cms.models


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0008_auto_20150507_1015'),
    ]

    operations = [
        migrations.AlterField(
            model_name='article',
            name='wide_image',
            field=models.ImageField(help_text=b'The wide image. Will be displayed at 1440x400.', null=True, upload_to=cms.models.generate_filename),
            preserve_default=True,
        ),
    ]
