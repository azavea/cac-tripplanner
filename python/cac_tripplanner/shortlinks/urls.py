from django.conf.urls import url
from django.views.decorators.csrf import csrf_exempt

from .views import ShortenedLinkRedirectView, ShortenedLinkCreateView

app_name = 'shortlinks'

urlpatterns = [
    url(r'^(?P<key>[1-9A-Za-z]{15,30})$', ShortenedLinkRedirectView.as_view(),
        name='dereference-shortened'),
    url(r'^shorten/$', csrf_exempt(ShortenedLinkCreateView.as_view()),
        name='shorten-link')
]
