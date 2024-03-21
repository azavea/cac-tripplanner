from django.urls import re_path
from django.views.decorators.csrf import csrf_exempt

from .views import ShortenedLinkRedirectView, ShortenedLinkCreateView

app_name = "shortlinks"

urlpatterns = [
    re_path(
        r"^(?P<key>[1-9A-Za-z]{15,30})$",
        ShortenedLinkRedirectView.as_view(),
        name="dereference-shortened",
    ),
    re_path(r"^shorten/$", csrf_exempt(ShortenedLinkCreateView.as_view()), name="shorten-link"),
]
