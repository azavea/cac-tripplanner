# -*- coding: utf-8 -*-


from django.db import models, migrations
from django.utils import timezone


ABOUT_PAGE = {
    'title': 'About',
    'slug': 'about',
    'content': 'About placeholder text',
    'publish_date': timezone.now(),
    'created': timezone.now(),
    'modified': timezone.now()
}

FAQ_PAGE = {
    'title': 'Frequently Asked Questions',
    'slug': 'faq',
    'content': 'FAQ placeholder text',
    'publish_date': timezone.now(),
    'created': timezone.now(),
    'modified': timezone.now()
}


def add_about_faq(apps, schema_editor):
    AboutFaq = apps.get_model('CMS', 'aboutfaq')
    admin_user = apps.get_model('auth', 'User').objects.filter(is_superuser=True).first()
    have_about = AboutFaq.objects.filter(slug=ABOUT_PAGE['slug'])
    have_faq = AboutFaq.objects.filter(slug=FAQ_PAGE['slug'])

    if len(have_about) == 0:
        default_about = AboutFaq(author=admin_user, **ABOUT_PAGE)
        default_about.save()

    if len(have_faq) == 0:
        default_faq = AboutFaq(author=admin_user, **FAQ_PAGE)
        default_faq.save()


def delete_about_faq(apps, schema_editor):
    AboutFaq = apps.get_model('CMS', 'aboutfaq')
    try:
        about = AboutFaq.objects.filter(slug=ABOUT_PAGE['slug'])
        faq = AboutFaq.objects.filter(slug=FAQ_PAGE['slug'])
        about.delete()
        faq.delete()
    except AboutFaq.DoesNotExist:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('CMS', '0006_aboutfaq'),
    ]

    operations = [
        migrations.RunPython(add_about_faq, delete_about_faq),
    ]
