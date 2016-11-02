from django.conf.urls import include, url
from django.contrib.gis import admin

from django.contrib.staticfiles import views as staticviews

from cms import views as cms_views
from destinations.views import (FindReachableDestinations,
                                SearchDestinations,
                                FeedEvents,
                                map as map_view,
                                directions as directions_view,
                                place_detail as place_detail_view)
import settings

urlpatterns = [
    # Home
    url(r'^$', cms_views.home, name='home'),

    # Map
    url(r'^api/destinations/search$', SearchDestinations.as_view(), name='api_destinations_search'),
    url(r'^api/feedevents$', FeedEvents.as_view(), name='api_feedevents'),
    url(r'^map/reachable$', FindReachableDestinations.as_view(), name='reachable'),
    url(r'^map/', map_view, name='map'),
    url(r'^directions/', directions_view, name='directions'),

    # Places
    url(r'^place/(?P<pk>[\d-]+)/$', place_detail_view, name='place-detail'),

    # About and FAQ
    url(r'^info/(?P<slug>[\w-]+)/$', cms_views.about_faq, name='about-faq'),

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
