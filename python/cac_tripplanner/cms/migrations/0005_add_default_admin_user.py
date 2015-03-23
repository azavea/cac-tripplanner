# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
from django.conf import settings
from django.contrib.auth.models import User

ADMIN_USER = {
    'email': settings.DEFAULT_ADMIN_EMAIL,
    'is_staff': True,
    'is_superuser': True,
    'username': settings.DEFAULT_ADMIN_USERNAME
}

def add_admin_user(apps, schema_editor):
    #Destination = apps.get_model('destinations', 'Destination')
    admin_user = User.objects.filter(username=ADMIN_USER['username'])
    if len(admin_user) == 0:
        default_admin = User(**ADMIN_USER)
        default_admin.set_password(settings.DEFAULT_ADMIN_PASSWORD)
        default_admin.save()


def delete_admin_user(apps, schema_editor):
    try:
        admin_user = User.objects.filter(username=ADMIN_USER['username'])
        admin_user.delete()
    except User.DoesNotExist:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0004_add_image_fields'),
    ]

    operations = [
        migrations.RunPython(add_admin_user, delete_admin_user),
    ]
