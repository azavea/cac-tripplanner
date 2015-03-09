from django.forms import ModelForm, ValidationError
from django.conf import settings
from django.core.files.images import get_image_dimensions

from .models import Destination


class DestinationForm(ModelForm):
    """Validate image dimensions"""
    class Meta:
        model = Destination

    def validate_image(self, field_name, aspect_ratio):
        """Helper function for validating an image

        :param field_name: String identifier for the image field
        :param aspect_ratio: Expected aspect ratio (width/height)
        """
        image = self.cleaned_data.get(field_name, False)
        if not image:
            raise ValidationError('Error reading uploaded image')

        if len(image) > 1024 * 1024 * settings.MAX_IMAGE_SIZE_MB:
            raise ValidationError('Image file too large (maximum {}mb)'
                                        .format(settings.MAX_IMAGE_SIZE_MB))

        width, height = get_image_dimensions(image)
        if width / height != aspect_ratio:
            raise ValidationError('Image has incorrect dimensions, expected {0}:1'
                                        .format(aspect_ratio))
        return image

    def clean_image(self):
        """Custom validator for image field"""
        return self.validate_image('image', 1)

    def clean_wide_image(self):
        """Custom validator for wide_image field"""
        return self.validate_image('wide_image', 2)
