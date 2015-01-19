from django.conf.urls import patterns, include, url
from django.contrib import admin

import settings
from django.contrib.staticfiles import views as staticviews


urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'cac_tripplanner.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),
    url(r'^$', 'cac_tripplanner.views.base', name='base'),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^ckeditor/', include('ckeditor.urls')),
)

if settings.DEBUG:
    urlpatterns += [
        url(r'^static/(?P<path>.*)$', staticviews.serve),
    ]
