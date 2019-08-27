from urllib.parse import urlparse

from django.forms import ModelForm, ValidationError
from django.core.urlresolvers import resolve, Resolver404

from .models import ShortenedLink


class ShortenedLinkForm(ModelForm):
    """Validate JSON for ShortenedLinks"""
    class Meta:
        model = ShortenedLink
        fields = ['key', 'destination', 'is_public']

    def clean_destination(self):
        """Validation"""
        dest = self.cleaned_data['destination']
        # Attempt to resolve the passed URL; don't allow people to generate
        # links to anywhere.
        components = urlparse(dest)
        try:
            resolve(components.path)
        except Resolver404:
            raise ValidationError('Only URLs to this site can be shortened.')
        return dest
