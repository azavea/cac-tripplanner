from django.conf.urls import url
from django.urls import include, path
from shortlinks.test.views import stub_view

app_name = 'shortlinks'

urlpatterns = [
    path('link/', include('shortlinks.urls')),
    url(r'^$', stub_view, name='test-home'),
]
