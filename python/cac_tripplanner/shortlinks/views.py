import json

from django.core.urlresolvers import reverse
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.generic import View
from django.views.generic.base import RedirectView

from .forms import ShortenedLinkForm
from .models import ShortenedLink, ShortenedLinkHit
from shortener import LinkShortener


class ShortenedLinkRedirectView(RedirectView):
    """Handle dereferencing shortened URLs"""
    permanent = False
    query_string = False  # Query string will be included in dereferenced URL
    http_method_names = ['get']

    def get_redirect_url(self, *args, **kwargs):
        """Creates a hit for this URL, then redirects."""
        short_url = get_object_or_404(ShortenedLink, key=kwargs['key'])
        ShortenedLinkHit.objects.create(link=short_url)
        return short_url.destination


class ShortenedLinkCreateView(View):
    """Handle creating shortened URLs"""
    http_method_names = ['post']

    def post(self, request, *args, **kwargs):
        """Create a new ShortRouteURL and return the shortened key."""
        try:
            data = json.loads(request.body)
        except ValueError:
            return HttpResponse(json.dumps({'error': True,
                                            'message': 'Invalid request data.'}),
                                status=400)
        # Add a unique key to the data; that's our shortened URL key
        data['key'] = LinkShortener().generate_key(data['destination'])
        link_form = ShortenedLinkForm(data)
        if link_form.is_valid():
            shortened = link_form.save()
            # Generate a full derefencing URL
            short_path = reverse('dereference-shortened',
                                 kwargs={'key': shortened.key})
            short_url = request.build_absolute_uri(short_path)
            return HttpResponse(json.dumps({'shortened_url': short_url}), status=201)
        else:
            return HttpResponse(json.dumps(link_form.errors), status=400)
