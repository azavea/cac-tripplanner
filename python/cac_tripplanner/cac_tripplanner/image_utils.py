import os
import uuid

from django.conf import settings
from django.core.files.images import get_image_dimensions
from django.forms import ValidationError


def generate_image_filename(prefix, instance, filename):
    """ Helper for creating unique image filenames

    Must be outside the model class because makemigrations throws the following error if not:
        ValueError: Could not find function generate_filename in <module>.models.
        Please note that due to Python 2 limitations, you cannot serialize unbound method functions
        (e.g. a method declared and used in the same class body). Please move the function into the
        main module body to use migrations. For more information, see
        https://docs.djangoproject.com/en/1.7/topics/migrations/#serializing-values

    Also cannot be a class method of the model because the function signature must exactly match:
    https://docs.djangoproject.com/en/1.7/ref/models/fields/#django.db.models.FileField.upload_to

    """
    _, ext = os.path.splitext(filename)
    return '{0}/{1}{2}'.format(prefix, uuid.uuid4().hex, ext)


def validate_image(image, aspect_ratio):
    """Helper function for validating an image

    :param image: Image object obtained from `cleaned_data`
    :param aspect_ratio: Expected aspect ratio (width/height)
    """

    if not image:
        raise ValidationError('Error reading uploaded image')

    if len(image) > 1024 * 1024 * settings.MAX_IMAGE_SIZE_MB:
        raise ValidationError('Image file too large (maximum {}mb)'
                              .format(settings.MAX_IMAGE_SIZE_MB))

    # Aspect ratio may be a decimal, so validate to a few decimal places
    width, height = get_image_dimensions(image)
    if abs(1.0 * width / height - aspect_ratio) > 0.001:
        raise ValidationError('Image has incorrect dimensions, expected {0}:1'
                              .format(aspect_ratio))
    return image
