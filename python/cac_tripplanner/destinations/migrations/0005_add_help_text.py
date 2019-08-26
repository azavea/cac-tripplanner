# -*- coding: utf-8 -*-


from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0004_feedevent_author'),
    ]

    operations = [
        migrations.AlterField(
            model_name='destination',
            name='address',
            field=models.CharField(help_text=b'The map automatically updates as the address is typed, but may be overridden manually if incorrect.', max_length=40, null=True),
            preserve_default=True,
        ),
    ]
