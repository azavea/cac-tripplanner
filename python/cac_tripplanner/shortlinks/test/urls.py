from django.conf.urls import url, include
from shortlinks.test.views import stub_view

urlpatterns = [
    url(r'^link/', include('shortlinks.urls')),
    url(r'^$', stub_view, name='test-home'),
]
