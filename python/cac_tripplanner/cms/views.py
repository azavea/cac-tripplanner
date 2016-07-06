import json
from random import shuffle

from django.core.urlresolvers import reverse
from django.http import HttpResponse
from django.shortcuts import render, get_object_or_404
from django.views.generic import View

from .models import AboutFaq, Article
from destinations.models import Destination
from cac_tripplanner.settings import FB_APP_ID, HOMEPAGE_RESULTS_LIMIT, DEBUG


def home(request):

    # get randomized community profile
    community_profile = Article.profiles.random()

    # get randomized tips and tricks
    tips_and_tricks = Article.tips.random()

    # get a few randomized destinations
    destination_ids = list(Destination.objects.published().values_list('id', flat=True))
    shuffle(destination_ids)
    destinations = Destination.objects.filter(id__in=destination_ids[:4])

    context = dict(community_profile=community_profile,
                   tips_and_tricks=tips_and_tricks,
                   destinations=destinations,
                   fb_app_id=FB_APP_ID,
                   debug=DEBUG)
    return render(request, 'home.html', context=context)


def about_faq(request, slug):
    page = get_object_or_404(AboutFaq.objects.all(), slug=slug)
    context = {'page': page, 'debug': DEBUG}
    return render(request, 'about-faq.html', context=context)


def community_profile_detail(request, slug):
    """Profile/Article view

    :param slug: article slug to lookup profile
    """
    community_profile = get_object_or_404(Article.profiles.published(),
                                          slug=slug)
    context = {'article': community_profile, 'debug': DEBUG}
    return render(request, 'community-profile-detail.html', context=context)


def tips_and_tricks_detail(request, slug):
    """Tips and tricks detail view

    :param slug: article slug to lookup tips and tricks
    """
    tips_and_tricks = get_object_or_404(Article.tips.published(),
                                        slug=slug)
    context = {'article': tips_and_tricks, 'debug': DEBUG}
    return render(request, 'tips-and-tricks-detail.html', context=context)

class AllArticles(View):
    """ API endpoint for the Articles model """

    def get(self, request, *args, **kwargs):
        """ GET title, URL, and images for the 20 most recent articles that are published"""
        results = Article.objects.published().order_by('-publish_date')[:HOMEPAGE_RESULTS_LIMIT]

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
