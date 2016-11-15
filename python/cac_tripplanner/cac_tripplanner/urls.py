from django.conf.urls import include, url
from django.views.generic import RedirectView
from django.contrib.gis import admin

from django.contrib.staticfiles import views as staticviews

from cms import views as cms_views
from destinations import views as dest_views

import settings

urlpatterns = [
    # Home view, which is also the directions and explore views
    url(r'^$', dest_views.home, name='home'),

    # Map
    url(r'^api/destinations/search$', dest_views.SearchDestinations.as_view(),
        name='api_destinations_search'),
    url(r'^api/feedevents$', dest_views.FeedEvents.as_view(), name='api_feedevents'),
    url(r'^map/reachable$', dest_views.FindReachableDestinations.as_view(), name='reachable'),

    url(r'^directions/', dest_views.directions, name='directions'),

    # Handle pre-redesign URLs by redirecting
    url(r'^map/directions/', RedirectView.as_view(pattern_name='home', query_string=True,
                                                  permanent=True)),

    # Places
    url(r'^place/(?P<pk>[\d-]+)/$', dest_views.place_detail, name='place-detail'),

    # About (no more FAQ)
    url(r'^(?P<slug>about)/$', cms_views.about_faq, name='about'),

    # All Published Articles
    url(r'^api/articles$', cms_views.AllArticles.as_view(), name='api_articles'),

    # Community Profiles
    url(r'^learn/$', cms_views.learn_list, name='learn-list'),
    url(r'^learn/(?P<slug>[\w-]+)/$', cms_views.learn_detail, name='learn-detail'),

    # Link Shortening
    url(r'^link/', include('shortlinks.urls')),

    url(r'^admin/', include(admin.site.urls)),
]

if settings.DEBUG:
    urlpatterns += [
        url(r'^static/(?P<path>.*)$', staticviews.serve),
    ]
