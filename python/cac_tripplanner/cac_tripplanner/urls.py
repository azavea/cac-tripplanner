from django.conf.urls import url
from django.urls import include
from django.views.generic import RedirectView
from django.contrib.gis import admin

from django.contrib.staticfiles import views as staticviews

from cms import views as cms_views
from destinations import views as dest_views

from django.conf import settings

urlpatterns = [
    # Home view, which is also the directions and explore views
    url(r'^$', dest_views.home, name='home'),
    url(r'^explore$', dest_views.explore, name='explore'),

    # App manifest and service worker for PWA app
    url('^manifest.json$', dest_views.manifest),
    url('^service-worker.js$', dest_views.service_worker),

    # Privacy policy and ToS
    url(r'^privacy_policy$', dest_views.privacy_policy, name='privacy_policy'),
    url(r'^terms_of_service$', dest_views.terms_of_service, name='terms_of_service'),

    # User destination flags
    url(r'^api/user_flag/', dest_views.UserFlagView.as_view()),

    # Map
    url(r'^api/destinations/search$', dest_views.SearchDestinations.as_view(),
        name='api_destinations_search'),
    url(r'^map/reachable$', dest_views.FindReachableDestinations.as_view(), name='reachable'),

    # Handle pre-redesign URLs by redirecting
    url(r'^(?:map/)?directions/', RedirectView.as_view(pattern_name='home', query_string=True,
                                                       permanent=True)),

    # Places
    url(r'^place/(?P<pk>[\d-]+)/$', dest_views.place_detail, name='place-detail'),

    # Events
    url(r'^event/(?P<pk>[\d-]+)/$', dest_views.event_detail, name='event-detail'),

    # About (no more FAQ)
    url(r'^(?P<slug>about)/$', cms_views.about_faq, name='about'),

    # All Published Articles
    url(r'^api/articles$', cms_views.AllArticles.as_view(), name='api_articles'),

    # Community Profiles
    url(r'^learn/$', cms_views.learn_list, name='learn-list'),
    url(r'^learn/(?P<slug>[\w-]+)/$', cms_views.learn_detail, name='learn-detail'),

    # Link Shortening
    url(r'link/', include('shortlinks.urls', namespace='shortlinks')),

    url(r'^admin/', admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += [
        url(r'^static/(?P<path>.*)$', staticviews.serve),
    ]
