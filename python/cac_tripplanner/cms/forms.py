from django.forms import ModelForm

from .models import (AboutFaq,
                     Article,
                     ARTICLE_NARROW_IMAGE_DIMENSIONS,
                     ARTICLE_WIDE_IMAGE_DIMENSIONS)

from cac_tripplanner.image_utils import validate_image


class AboutFaqForm(ModelForm):
    """About and FAQ pages"""
    class Meta:
        model = AboutFaq
        exclude = []


class ArticleForm(ModelForm):
    class Meta:
        model = Article
        exclude = []

    def clean_wide_image_raw(self):
        """Custom validator for wide_image field"""
        return validate_image(self.cleaned_data.get('wide_image_raw', False),
                              ARTICLE_WIDE_IMAGE_DIMENSIONS)

    def clean_narrow_image_raw(self):
        """Custom validator for narrow image field"""
        return validate_image(self.cleaned_data.get('narrow_image_raw', False),
                              ARTICLE_NARROW_IMAGE_DIMENSIONS)
