from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils.timezone import now

from cms.models import Article


def community_profile_detail(request, slug):
    """Profile/Article view

    :param slug: article slug to lookup profile
    """
    community_profile = get_object_or_404(Article,
                                          slug=slug,
                                          publish_date__lt=now())
    context = RequestContext(request, {'article': community_profile})
    return render_to_response('community-profile-detail.html',
                              context_instance=context)

def tips_and_tricks_detail(request, slug):
    """Tips and tricks detail view

    :param slug: article slug to lookup tips and tricks
    """
    tips_and_tricks = get_object_or_404(Article,
                                        slug=slug,
                                        publish_date__lt=now(),
                                        content_type=Article.ArticleTypes.tips_and_tricks)
    context = RequestContext(request, {'article': tips_and_tricks})
    return render_to_response('tips-and-tricks-detail.html',
                              context_instance=context)
