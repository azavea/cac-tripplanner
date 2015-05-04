import json
from random import shuffle

from django.core.urlresolvers import reverse
from django.http import HttpResponse
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.views.generic import View

from .models import AboutFaq, Article
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
        """ GET title, URL, and images for the 20 most recent articles that are published"""
        results = Article.objects.published().order_by('-publish_date')[:20]

        # resolve full URLs to articles and their images
        response = []
        for obj in results:
            article = {}
            article['wide_image'] = obj.wide_image.url
            article['narrow_image'] = obj.narrow_image.url
            article['title'] = obj.title
            if obj.content_type == 'prof':
                relative_url = reverse(community_profile_detail, args=[obj.slug])
            else:
                relative_url = reverse(tips_and_tricks_detail, args=[obj.slug])
            article['url'] = request.build_absolute_uri(relative_url)
            response.append(article)

        return HttpResponse(json.dumps(response), 'application/json')
