from django.forms import ModelForm, ValidationError

from .models import Destination, Event


class DestinationForm(ModelForm):

    class Meta:
        model = Destination
        exclude = []


class EventForm(ModelForm):

    class Meta:
        model = Event
        exclude = []

    def __init__(self, *args, **kwargs):
        super(EventForm, self).__init__(*args, **kwargs)
        self.fields['destination'].widget.can_delete_related = False
        self.fields['destination'].widget.can_add_related = False
        self.fields['destination'].widget.can_change_related = False

    def clean(self):
        """Validate start date is less than end date"""
        cleaned_data = super(EventForm, self).clean()
        start = self.cleaned_data.get('start_date')
        end = self.cleaned_data.get('end_date')

        if start and end and start >= end:
            self.add_error('start_date', ValidationError('Start date must be before end date.'))

        return cleaned_data
