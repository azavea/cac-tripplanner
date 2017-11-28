from django.forms import ModelForm

from .models import Destination, Event
from cac_tripplanner.image_utils import validate_image


class DestinationForm(ModelForm):
    """Validate image dimensions"""
    class Meta:
        model = Destination
        exclude = []

    def clean_image(self):
        """Custom validator for image field"""
        return validate_image(self.cleaned_data.get('image', False), 310, 155)

    def clean_wide_image(self):
        """Custom validator for wide_image field"""
        return validate_image(self.cleaned_data.get('wide_image', False), 680, 400)


class EventForm(DestinationForm):
    """Validate image dimensions"""
    class Meta:
        model = Event
        exclude = []
