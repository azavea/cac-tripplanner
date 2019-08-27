# -*- coding: utf-8 -*-


from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shortlinks', '0003_auto_20150513_1039'),
    ]

    operations = [
        migrations.AlterField(
            model_name='shortenedlink',
            name='destination',
            field=models.CharField(max_length=2048),
        ),
    ]
