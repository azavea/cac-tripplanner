from django.forms import ModelForm

from .models import AboutFaq, Article
from cac_tripplanner.image_utils import validate_image


class AboutFaqForm(ModelForm):
    """About and FAQ pages"""
    class Meta:
        model = AboutFaq
        exclude = []


class ArticleForm(ModelForm):
    """Validate image dimensions"""
    class Meta:
        model = Article
        exclude = []

    def clean_wide_image(self):
        """Custom validator for wide_image field"""
        return validate_image(self.cleaned_data.get('wide_image', False), 1440, 400)

    def clean_narrow_image(self):
        """Custom validator for narrow image field"""
        return validate_image(self.cleaned_data.get('narrow_image', False), 310, 218)
