from django.conf.urls import re_path
from django.urls import include
from django.views.generic import RedirectView
from django.contrib.gis import admin

from django.contrib.staticfiles import views as staticviews

from cms import views as cms_views
from destinations import views as dest_views

from django.conf import settings

urlpatterns = [
    # Home view, which is also the directions and explore views
    re_path(r"^$", dest_views.home, name="home"),
    re_path(r"^explore$", dest_views.explore, name="explore"),
    # App manifest and service worker for PWA app
    re_path("^manifest.json$", dest_views.manifest),
    re_path("^service-worker.js$", dest_views.service_worker),
    # Privacy policy and ToS
    re_path(r"^privacy_policy$", dest_views.privacy_policy, name="privacy_policy"),
    re_path(r"^terms_of_service$", dest_views.terms_of_service, name="terms_of_service"),
    # User destination flags
    re_path(r"^api/user_flag/", dest_views.UserFlagView.as_view()),
    # Map
    re_path(
        r"^api/destinations/search$",
        dest_views.SearchDestinations.as_view(),
        name="api_destinations_search",
    ),
    re_path(r"^map/reachable$", dest_views.FindReachableDestinations.as_view(), name="reachable"),
    # Handle pre-redesign URLs by redirecting
    re_path(
        r"^(?:map/)?directions/",
        RedirectView.as_view(pattern_name="home", query_string=True, permanent=True),
    ),
    # Places
    re_path(r"^place/(?P<pk>[\d-]+)/$", dest_views.place_detail, name="place-detail"),
    # Events
    re_path(r"^event/(?P<pk>[\d-]+)/$", dest_views.event_detail, name="event-detail"),
    # Tours
    re_path(r"^tour/(?P<pk>[\d-]+)/$", dest_views.tour_detail, name="tour-detail"),
    # About (no more FAQ)
    re_path(r"^(?P<slug>about)/$", cms_views.about_faq, name="about"),
    # All Published Articles
    re_path(r"^api/articles$", cms_views.AllArticles.as_view(), name="api_articles"),
    # Community Profiles
    re_path(r"^learn/$", cms_views.learn_list, name="learn-list"),
    re_path(r"^learn/(?P<slug>[\w-]+)/$", cms_views.learn_detail, name="learn-detail"),
    # Link Shortening
    re_path(r"^link/", include("shortlinks.urls", namespace="shortlinks")),
    re_path(r"^admin/", admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += [
        re_path(r"^static/(?P<path>.*)$", staticviews.serve),
    ]
