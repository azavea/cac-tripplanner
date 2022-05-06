from django.conf.urls import re_path
from django.urls import include, path
from shortlinks.test.views import stub_view

app_name = 'shortlinks'

urlpatterns = [
    path('link/', include('shortlinks.urls')),
    re_path(r'^$', stub_view, name='test-home'),
]
