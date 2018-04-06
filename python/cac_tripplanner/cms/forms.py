from django.forms import ModelForm

from .models import AboutFaq, Article


class AboutFaqForm(ModelForm):
    """About and FAQ pages"""
    class Meta:
        model = AboutFaq
        exclude = []


class ArticleForm(ModelForm):
    class Meta:
        model = Article
        exclude = []
