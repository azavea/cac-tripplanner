# -*- coding: utf-8 -*-


from django.db import models, migrations
import cms.models


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0003_remove_article_published'),
    ]

    operations = [
        migrations.AddField(
            model_name='article',
            name='narrow_image',
            field=models.ImageField(help_text=b'The narrow image. Will be displayed at 400x600.',
                                    null=True, upload_to=cms.models.generate_filename),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='article',
            name='wide_image',
            field=models.ImageField(help_text=b'The wide image. Will be displayed at 600x300.',
                                    null=True, upload_to=cms.models.generate_filename),
            preserve_default=True,
        ),
    ]
