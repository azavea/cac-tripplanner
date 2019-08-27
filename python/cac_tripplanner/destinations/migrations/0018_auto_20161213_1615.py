# -*- coding: utf-8 -*-


from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0017_destination_priority'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='destination',
            options={'ordering': ['priority', '?']},
        ),
    ]
