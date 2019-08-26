# -*- coding: utf-8 -*-


from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0007_destination_website_url'),
    ]

    operations = [
        migrations.AlterField(
            model_name='destination',
            name='image',
            field=models.ImageField(help_text=b'The full-size image. Will be displayed at 400x400.', null=True, upload_to=b'destinations/'),
            preserve_default=True,
        ),
    ]
