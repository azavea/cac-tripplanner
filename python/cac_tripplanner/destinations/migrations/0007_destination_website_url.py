# -*- coding: utf-8 -*-


from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0006_add_city_state_defaults'),
    ]

    operations = [
        migrations.AddField(
            model_name='destination',
            name='website_url',
            field=models.URLField(blank=True, null=True),
            preserve_default=False,
        ),
    ]
