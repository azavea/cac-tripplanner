import json
from random import shuffle

from django.core.urlresolvers import reverse
from django.http import HttpResponse
from django.shortcuts import render, get_object_or_404
from django.views.generic import View

from .models import AboutFaq, Article
from destinations.models import Destination
from cac_tripplanner.settings import FB_APP_ID, HOMEPAGE_RESULTS_LIMIT, DEBUG


DEFAULT_CONTEXT = {
    'debug': DEBUG,
    'fb_app_id': FB_APP_ID,
}

def home(request):

    # Get a random article
    article = Article.objects.random()

    # get a few randomized destinations
    destination_ids = list(Destination.objects.published().values_list('id', flat=True))
    shuffle(destination_ids)
    destinations = Destination.objects.filter(id__in=destination_ids[:4])

    context = dict(tab='home',
                   article=article,
                   destinations=destinations,
                   **DEFAULT_CONTEXT)
    return render(request, 'home.html', context=context)


def about_faq(request, slug):
    page = get_object_or_404(AboutFaq.objects.all(), slug=slug)
    context = dict(tab='info', page=page, **DEFAULT_CONTEXT)
    return render(request, 'about-faq.html', context=context)

def place_detail(request, pk):
    destination = get_object_or_404(Destination.objects.published(), pk=pk)
    more_destinations = Destination.objects.published().order_by('?').exclude(pk=destination.pk)[:3]
    context = dict(tab='explore', destination=destination, more_destinations=more_destinations, **DEFAULT_CONTEXT)
    return render(request, 'place-detail.html', context=context)

def learn_list(request):
    articles = Article.objects.published().order_by('-publish_date')
    context = dict(tab='info', articles=articles, **DEFAULT_CONTEXT)
    return render(request, 'learn-list.html', context=context)

def learn_detail(request, slug):
    article = get_object_or_404(Article.objects.published(), slug=slug)
    more_articles = Article.objects.published().order_by('-publish_date').exclude(pk=article.pk)[:3]
    context = dict(tab='info', article=article, more_articles=more_articles, **DEFAULT_CONTEXT)
    return render(request, 'learn-detail.html', context=context)


class AllArticles(View):
    """ API endpoint for the Articles model """

    def serialize_article(self, request, article):
        return {
            'wide_image': article.wide_image.url,
            'narrow_image': article.narrow_image.url,
            'title': article.title,
            'url': request.build_absolute_uri(reverse(learn_detail, args=[article.slug]))
        }

    def get(self, request, *args, **kwargs):
        """ GET title, URL, and images for published articles """
        try:
            limit = int(request.GET.get('limit'))
        except (ValueError, TypeError):
            limit = HOMEPAGE_RESULTS_LIMIT

        results = Article.objects.published().order_by('-publish_date')[:limit]
        response = [self.serialize_article(request, article) for article in results]
        return HttpResponse(json.dumps(response), 'application/json')
