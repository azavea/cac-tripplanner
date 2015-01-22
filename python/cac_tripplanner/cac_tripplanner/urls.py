from django.conf.urls import patterns, include, url
from django.contrib.gis import admin

from django.contrib.staticfiles import views as staticviews

from .views import Reachable
import settings

urlpatterns = patterns('',
    url(r'^$', 'cac_tripplanner.views.home', name='home'),
    url(r'^map/$', 'cac_tripplanner.views.map', name='map'),
    url(r'^reachable$', Reachable.as_view(), name='reachable'),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^ckeditor/', include('ckeditor.urls')),
)

if settings.DEBUG:
    urlpatterns += [
        url(r'^static/(?P<path>.*)$', staticviews.serve),
    ]

