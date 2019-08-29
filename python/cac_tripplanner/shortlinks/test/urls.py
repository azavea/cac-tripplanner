from django.conf.urls import url
from shortlinks.test.views import stub_view
from shortlinks import urls as shortlink_urls

urlpatterns = [
    url(r'^link/', shortlink_urls),
    url(r'^$', stub_view, name='test-home'),
]
