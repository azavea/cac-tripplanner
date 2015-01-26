"""
Django settings for cac_tripplanner project.

For more information on this file, see
https://docs.djangoproject.com/en/1.7/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.7/ref/settings/
"""

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
import os
import yaml
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

try:
    secrets = yaml.safe_load(open('/etc/cac_secrets', 'r'))
except (IOError, NameError):
    secrets = {
        'secret_key': '%&_DEVELOPMENT_SECRET_KEY_#42*pk!3y6lvk&1psyk=e=pr',
        'database': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': 'cac_tripplanner',
            'USER': 'cac_tripplanner',
            'PASSWORD': 'cac_tripplanner',
            'HOST': '192.168.8.25',
            'PORT': '5432'
        },
        'otp_url': 'http://192.168.8.26:8080/otp/routers/{router}/',
        'allowed_hosts': ['127.0.0.1', 'localhost'],
        'internal_ips': ('0.0.0.0', '127.0.0.1',),
        'build_dir': '/opt/app/src',
        'production': False
    }

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.7/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = secrets['secret_key']

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = not secrets['production']

TEMPLATE_DEBUG = not secrets['production']

ALLOWED_HOSTS = secrets['allowed_hosts']

INTERNAL_IPS = secrets['internal_ips']

# Application definition

INSTALLED_APPS = (
    'wpadmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',

    # Third Party Apps
    'ckeditor',
    'django_extensions',

    # Project Apps
    'cms',
    'destinations',
    'shortlinks',
)

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.auth.middleware.SessionAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

ROOT_URLCONF = 'cac_tripplanner.urls'

WSGI_APPLICATION = 'cac_tripplanner.wsgi.application'


# Database
# https://docs.djangoproject.com/en/1.7/ref/settings/#databases

DATABASES = {
    'default': secrets['database']
}

# Internationalization
# https://docs.djangoproject.com/en/1.7/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'America/New_York'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.7/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = '/srv/cac'
STATICFILES_DIRS = ()

# TEMPLATE CONFIGURATION
# See: https://docs.djangoproject.com/en/dev/ref/settings/#template-context-processors
TEMPLATE_CONTEXT_PROCESSORS = (
    'django.contrib.auth.context_processors.auth',
    'django.core.context_processors.debug',
    'django.core.context_processors.i18n',
    'django.core.context_processors.media',
    'django.core.context_processors.static',
    'django.core.context_processors.tz',
    'django.contrib.messages.context_processors.messages',
    'django.core.context_processors.request',
)

# See: https://docs.djangoproject.com/en/dev/ref/settings/#template-loaders
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.Loader',
    'django.template.loaders.app_directories.Loader',
)

# See: https://docs.djangoproject.com/en/dev/ref/settings/#template-dirs
TEMPLATE_DIRS = (
    os.path.normpath(os.path.join(BASE_DIR, 'templates')),
)

CKEDITOR_UPLOAD_PATH = 'uploads/'
CKEDITOR_IMAGE_BACKEND = 'pillow'

# TODO: delete later.
CKEDITOR_JQUERY_URL = '//ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js'

WPADMIN = {
    'admin': {
        'title': 'Clean Air Council Content Management System',
        'menu': {
            'top': 'wpadmin.menu.menus.BasicTopMenu',
            'left': 'wpadmin.menu.menus.BasicLeftMenu'
        }
    }
}

# OTP CONFIGURATION
OTP_URL = secrets['otp_url']
