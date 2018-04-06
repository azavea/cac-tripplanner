import os
import uuid


def generate_image_filename(prefix, instance, filename):
    """Helper for creating unique image filenames

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
