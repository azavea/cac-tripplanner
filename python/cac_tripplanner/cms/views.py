from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext

from .models import Article


def home(request):

    # get randomized community profile
    community_profile = Article.profiles.random()

    # get randomized tips and tricks
    tips_and_tricks = Article.tips.random()

    context = RequestContext(request,
                             dict(community_profile=community_profile,
                                  tips_and_tricks=tips_and_tricks))
    return render_to_response('home.html', context_instance=context)


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
