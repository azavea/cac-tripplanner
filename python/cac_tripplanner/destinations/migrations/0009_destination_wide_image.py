# -*- coding: utf-8 -*-


from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0008_add_image_help_text'),
    ]

    operations = [
        migrations.AddField(
            model_name='destination',
            name='wide_image',
            field=models.ImageField(help_text=b'The half-height image. Will be displayed at 400x200.', null=True, upload_to=b'destinations/'),
            preserve_default=True,
        ),
    ]
