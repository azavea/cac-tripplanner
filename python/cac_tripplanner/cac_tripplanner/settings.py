"""
Django settings for cac_tripplanner project.

For more information on this file, see
https://docs.djangoproject.com/en/1.7/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.7/ref/settings/
"""
import os
import yaml

import django

from boto.utils import get_instance_metadata
from django.core.exceptions import ImproperlyConfigured

from easy_thumbnails.conf import Settings as thumbnail_settings

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# Tell image cropping library to use Django admin jquery,
# or else loading the image cropper will fail for destinations admin
# because it loads jquery for gis.admin.OSMGeoAdmin
IMAGE_CROPPING_JQUERY_URL = "/static/admin/js/vendor/jquery/jquery.js"

# https://django-storages.readthedocs.io/en/latest/backends/amazon-S3.html
# inherit the bucket's ACL
AWS_DEFAULT_ACL = None

try:
    with open("/etc/cac_secrets", "r") as secrets_file:
        secrets = yaml.safe_load(secrets_file)
except (OSError, NameError):
    # Note: secrets are read in via a YAML file, so make sure nothing is added
    # here that cannot be represented in YAML. One example is a tuple: represent
    # it as a list here, and then convert to a tuple later on (see internal_ips).
    secrets = {
        "secret_key": "%&_DEVELOPMENT_SECRET_KEY_#42*pk!3y6lvk&1psyk=e=pr",
        "database": {
            "ENGINE": "django.contrib.gis.db.backends.postgis",
            "NAME": "cac_tripplanner",
            "USER": "cac_tripplanner",
            "PASSWORD": "cac_tripplanner",
            "HOST": "192.168.56.25",
            "PORT": "5432",
        },
        # Note: the OTP URL is called directly from within javascript. In
        # order to view the page on an external machine, this URL must be
        # overridden via the secrets file. This can't be automatically set
        # to the host machine's DNS here, because this code runs in a VM.
        "otp_url": "http://192.168.56.26/otp/routers/{router}/",
        "internal_ips": ["0.0.0.0", "127.0.0.1"],
        "postgis_version": [2, 5, 2],
        "build_dir": "/opt/app/src",
        "production": False,
        # For storing images on s3, set 'use_s3_storage' to True and specify the bucket name.
        # AWS access key and secret access keys will be obtained via the IAM role.
        "use_s3_storage": False,
        "aws_storage_bucket_name": "",
        # Facebook app ID
        "fb_app_id": "",
        # API key for posting user flag events
        "user_flag_api_key": "",
        "default_admin_username": "admin",
        "default_admin_password": "admin",
        "default_admin_email": "systems+cac@azavea.com",
    }


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.7/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = secrets["secret_key"]

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = not secrets["production"]

# String that must be passed to post user flags for destinations or events (liked, been, etc.)
USER_FLAG_API_KEY = secrets["user_flag_api_key"]

ALLOWED_HOSTS = [
    ".gophillygo.org",
    ".elb.amazonaws.com",
    "localhost",
    ".ngrok.io",
]

if secrets["production"]:
    instance_metadata = get_instance_metadata()

    if not instance_metadata:
        raise ImproperlyConfigured("Unable to access instance metadata")

    # ELBs use the instance IP in the Host header and ALLOWED_HOSTS
    # checks against the Host header.
    ALLOWED_HOSTS.append(instance_metadata["local-ipv4"])

INTERNAL_IPS = tuple(secrets["internal_ips"])

# Needed in order to call collectstatic without a DB (during AMI creation)
POSTGIS_VERSION = tuple(secrets["postgis_version"])

# Application definition

INSTALLED_APPS = (
    "wpadmin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    # Third Party Apps
    "ckeditor",
    "django_extensions",
    "storages",
    "easy_thumbnails",
    "image_cropping",
    # Project Apps
    "cms",
    "destinations",
    "shortlinks",
)

MIDDLEWARE = (
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
)

ROOT_URLCONF = "cac_tripplanner.urls"

WSGI_APPLICATION = "cac_tripplanner.wsgi.application"


# Database
# https://docs.djangoproject.com/en/1.7/ref/settings/#databases

DATABASES = {"default": secrets["database"]}

# Image processing configuration
IMAGE_CROPPING_SIZE_WARNING = True

THUMBNAIL_PROCESSORS = (
    "image_cropping.thumbnail_processors.crop_corners",
) + thumbnail_settings.THUMBNAIL_PROCESSORS

IMAGE_CROPPER_HELP_TEXT = """Save and return to editing this record to see an uploaded image and
to change how the image is cropped."""


# Internationalization
# https://docs.djangoproject.com/en/1.7/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "America/New_York"

USE_I18N = True

USE_TZ = True

# Directory for default featured destinations added in destinations 0012
# subdir of MEDIA_ROOT
# used in migration destinations 0016, DO NOT put any other files in this media folder
# they will be deleted on a backwards migration from 0016 -> 0015
# NOTE: If the images placed here are to be used in production as well, they will need to be copied
# to the bucket specified in AWS_STORAGE_BUCKET_NAME
DEFAULT_MEDIA_PATH = "default_media"
# src directory for default media images
DEFAULT_MEDIA_SRC_PATH = os.path.join(BASE_DIR, DEFAULT_MEDIA_PATH)

# Added in 3.2. This is used to create id fields for models where it's not explicitly specified in
# the model definition. This requires making an explicit choice or Django will issue warnings, so
# make our choice the same as what the default was before the requirement to make an affirmative
# choice was introduced.
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.7/howto/static-files/

STATIC_URL = "/static/"
STATIC_ROOT = "/srv/cac"
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static/'),
]

MEDIA_ROOT = "/media/cac/"
MEDIA_URL = "/media/"

# LOGGING CONFIGURATION
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "datefmt": "%Y-%m-%d %H:%M:%S %z",
            "format": ("[%(asctime)s] [%(process)d] [%(levelname)s]" " %(message)s"),
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "level": "INFO", "formatter": "verbose",},
        "logfile": {
            "level": "DEBUG",
            "class": "logging.FileHandler",
            "formatter": "verbose",
            "filename": os.path.join(BASE_DIR, "cac-tripplanner-app.log"),
        },
    },
    "loggers": {
        "django": {"handlers": ["console", "logfile"], "level": "INFO", "propagate": True,},
        "ckeditor": {"handlers": ["console", "logfile"], "level": "DEBUG", "propagate": True,},
        "wpadmin": {"handlers": ["console", "logfile"], "level": "DEBUG", "propagate": True,},
        "destinations": {"handlers": ["console", "logfile"], "level": "DEBUG", "propagate": True,},
        "cms": {"handlers": ["console", "logfile"], "level": "DEBUG", "propagate": True,},
        "shortlinks": {"handlers": ["console", "logfile"], "level": "DEBUG", "propagate": True,},
        "image_cropping.thumbnail_processors": {
            "handlers": ["console", "logfile"],
            "level": "DEBUG",
            "propagate": True,
        },
    },
}

# TEMPLATE CONFIGURATION
# See https://docs.djangoproject.com/en/1.11/ref/settings/#templates

# set renderer
# https://docs.djangoproject.com/en/1.11/ref/forms/renderers/#django.forms.renderers.TemplatesSetting
FORM_RENDERER = "django.forms.renderers.TemplatesSetting"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            os.path.normpath(os.path.join(BASE_DIR, "templates")),
            "django/forms/templates",
            "templates",
            os.path.normpath(os.path.join(django.__path__[0] + "/forms/templates")),
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "debug": DEBUG,
            "context_processors": [
                "django.contrib.auth.context_processors.auth",
                "django.template.context_processors.debug",
                "django.template.context_processors.i18n",
                "django.template.context_processors.media",
                "django.template.context_processors.static",
                "django.template.context_processors.tz",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.request",
            ],
        },
    },
]

CKEDITOR_UPLOAD_PATH = "uploads/"
CKEDITOR_IMAGE_BACKEND = "pillow"

CKEDITOR_CONFIGS = {
    "default": {
        "toolbar": [
            [
                "Styles",
                "Format",
                "Bold",
                "Italic",
                "Underline",
                "Strike",
                "SpellChecker",
                "Undo",
                "Redo",
            ],
            ["Link", "Unlink", "Anchor"],
            ["Table", "HorizontalRule"],
            ["SpecialChar"],
            ["Source"],
        ],
        "extraPlugins": ",".join(["autolink", "autoembed", "embed", "embedsemantic", "autogrow"]),
    },
    "teaser": {
        "toolbar": [
            [
                "Styles",
                "Format",
                "Bold",
                "Italic",
                "Underline",
                "Strike",
                "SpellChecker",
                "Undo",
                "Redo",
            ],
            [],
            [],
            ["SpecialChar"],
            [],
        ],
        "extraPlugins": "",
    },
}

WPADMIN = {
    "admin": {
        "title": "Clean Air Council Content Management System",
        "menu": {
            "top": "wpadmin.menu.menus.BasicTopMenu",
            "left": "wpadmin.menu.menus.BasicLeftMenu",
        },
        'custom_style': STATIC_URL + 'admin/css/pagination.css',
    }
}

# FACEBOOK CONFIGURATION
FB_APP_ID = secrets["fb_app_id"]

# OTP CONFIGURATION
OTP_URL = secrets["otp_url"]
ROUTING_URL = OTP_URL.format(router="default") + "plan"
ISOCHRONE_URL = OTP_URL.format(router="default") + "isochrone"

# Settings for S3 storage
# No need to specify AWS access and secret keys -- they are pulled from
# the instance metadata by boto.
if secrets["use_s3_storage"]:
    DEFAULT_FILE_STORAGE = "cac_tripplanner.custom_storages.PublicS3BotoStorage"
    AWS_STORAGE_BUCKET_NAME = secrets["aws_storage_bucket_name"]

# Default user
DEFAULT_ADMIN_USERNAME = secrets["default_admin_username"]
DEFAULT_ADMIN_PASSWORD = secrets["default_admin_password"]
DEFAULT_ADMIN_EMAIL = secrets["default_admin_email"]

# Application settings
#
MAX_IMAGE_SIZE_MB = 2

# limit the number of featured destinations/articles returned by "view all" to this amount
# TODO: paginate instead?
HOMEPAGE_RESULTS_LIMIT = 20
