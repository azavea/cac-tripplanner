import logging

from django.forms import ModelForm, ValidationError

from cac_tripplanner.image_utils import validate_image

from .models import (Destination, Event, EventDestination, Tour, TourDestination,
                     NARROW_IMAGE_DIMENSIONS, WIDE_IMAGE_DIMENSIONS)

logger = logging.getLogger(__name__)


class ExtraImagesForm(ModelForm):
    def clean_image_raw(self):
        """Custom validator for image field"""
        return validate_image(self.cleaned_data.get('image_raw', False), WIDE_IMAGE_DIMENSIONS)


class DestinationForm(ModelForm):

    class Meta:
        model = Destination
        exclude = []

    def clean_image_raw(self):
        """Custom validator for image field"""
        return validate_image(self.cleaned_data.get('image_raw', False), NARROW_IMAGE_DIMENSIONS)

    def clean_wide_image_raw(self):
        """Custom validator for wide_image field"""
        return validate_image(self.cleaned_data.get('wide_image_raw', False), WIDE_IMAGE_DIMENSIONS)


class EventForm(DestinationForm):
    """Subclass DestinationForm for image validation."""

    class Meta:
        model = Event
        exclude = ['destinations']

    def clean(self):
        """Validate start date is less than end date"""
        cleaned_data = super(EventForm, self).clean()
        start = self.cleaned_data.get('start_date')
        end = self.cleaned_data.get('end_date')

        if start and end and start >= end:
            self.add_error('start_date', ValidationError('Start date must be before end date.'))

        return cleaned_data


class OrderedDestinationForm(ModelForm):

    def __init__(self, *args, **kwargs):
        # Autoincrement the 'order' number for first new tour destination added.
        prefix = kwargs['prefix'][len(kwargs['prefix']) - 1:] if 'prefix' in kwargs else ''
        order = int(prefix) + 1 if prefix.isnumeric() else 0

        if 'instance' not in kwargs and order > 0:
            if 'initial' not in kwargs:
                kwargs['initial'] = {}
            kwargs['initial'].update({'order': order})
        return super(OrderedDestinationForm, self).__init__(*args, **kwargs)


class TourDestinationForm(OrderedDestinationForm):

    class Meta:
        model = TourDestination
        exclude = []


class EventDestinationForm(OrderedDestinationForm):

    class Meta:
        model = EventDestination
        exclude = []

    def clean(self):
        """Validate start date is less than end date"""
        cleaned_data = super(EventDestinationForm, self).clean()
        start = self.cleaned_data.get('start_date')
        end = self.cleaned_data.get('end_date')

        if start and end and start >= end:
            self.add_error('start_date', ValidationError('Start date must be before end date.'))

        return cleaned_data


class TourForm(ModelForm):

    class Meta:
        model = Tour
        exclude = ['destinations']
