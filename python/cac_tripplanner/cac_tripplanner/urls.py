from django.conf.urls import patterns, include, url
from django.contrib.gis import admin

from django.contrib.staticfiles import views as staticviews

from destinations.views import FindReachableDestinations, SearchDestinations, FeedEvents
import settings

urlpatterns = patterns(
    '',
    # Home
    url(r'^$', 'cms.views.home', name='home'),

    # Map
    url(r'^api/destinations/search$', SearchDestinations.as_view(), name='api_destinations_search'),
    url(r'^api/feedevents$', FeedEvents.as_view(), name='api_feedevents'),
    url(r'^map/reachable$', FindReachableDestinations.as_view(), name='reachable'),
    url(r'^map/', 'destinations.views.map', name='map'),

    # Community Profiles
    url(r'^community-profile/(?P<slug>[\w-]+)/$',
        'cms.views.community_profile_detail',
        name='community-profile-detail'),

    # Tips and Tricks
    url(r'^tips-and-tricks/(?P<slug>[\w-]+)/$',
        'cms.views.tips_and_tricks_detail',
        name='tips-and-tricks-detail'),

    # Link Shortening
    url(r'^link/', include('shortlinks.urls')),

    url(r'^admin/', include(admin.site.urls)),
    url(r'^ckeditor/', include('ckeditor.urls')),
)

if settings.DEBUG:
    urlpatterns += [
        url(r'^static/(?P<path>.*)$', staticviews.serve),
    ]
