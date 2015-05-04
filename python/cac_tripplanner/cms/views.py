import json
from random import shuffle

from django.forms.models import model_to_dict
from django.http import HttpResponse
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.views.generic import View

from .models import AboutFaq, Article
from cac_tripplanner.settings import MEDIA_URL
from destinations.models import Destination


def home(request):

    # get randomized community profile
    community_profile = Article.profiles.random()

    # get randomized tips and tricks
    tips_and_tricks = Article.tips.random()

    # get a few randomized destinations
    # TODO: Investigate performance, as this creates a list of every destination
    #       before shuffling and slicing
    destinations = list(Destination.objects.published())
    shuffle(destinations)

    context = RequestContext(request,
                             dict(community_profile=community_profile,
                                  tips_and_tricks=tips_and_tricks,
                                  destinations=destinations[:4]))
    return render_to_response('home.html', context_instance=context)


def about_faq(request, slug):
    page = get_object_or_404(AboutFaq.objects.all(), slug=slug)
    context = RequestContext(request, {'page': page})
    return render_to_response('about-faq.html', context_instance=context)


def community_profile_detail(request, slug):
    """Profile/Article view

    :param slug: article slug to lookup profile
    """
    community_profile = get_object_or_404(Article.profiles.published(),
                                          slug=slug)
    context = RequestContext(request, {'article': community_profile})
    return render_to_response('community-profile-detail.html',
                              context_instance=context)


def tips_and_tricks_detail(request, slug):
    """Tips and tricks detail view

    :param slug: article slug to lookup tips and tricks
    """
    tips_and_tricks = get_object_or_404(Article.tips.published(),
                                        slug=slug)
    context = RequestContext(request, {'article': tips_and_tricks})
    return render_to_response('tips-and-tricks-detail.html',
                              context_instance=context)

class AllArticles(View):
    """ API endpoint for the Articles model """

    def get(self, request, *args, **kwargs):
        """ GET title, slug, and images for the 20 most recent articles that are published"""
        results = Article.objects.published().values('title',
                                             'slug',
                                             'wide_image',
                                             'narrow_image').order_by('publish_date')[:20]

        for obj in results:
            obj['wide_image'] = MEDIA_URL + obj['wide_image']
            obj['narrow_image'] = MEDIA_URL + obj['narrow_image']

        return HttpResponse(json.dumps(list(results)), 'application/json')
