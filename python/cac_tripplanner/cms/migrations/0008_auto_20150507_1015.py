# -*- coding: utf-8 -*-


from django.db import models, migrations
import cms.models


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0007_add_defalut_aboutfaq'),
    ]

    operations = [
        migrations.AlterField(
            model_name='article',
            name='wide_image',
            field=models.ImageField(help_text=b'The wide image. Will be displayed at 1280x400.', null=True, upload_to=cms.models.generate_filename),
            preserve_default=True,
        ),
    ]
