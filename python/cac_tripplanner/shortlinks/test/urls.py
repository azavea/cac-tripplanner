from django.urls import include, path, re_path
from shortlinks.test.views import stub_view

app_name = 'shortlinks'

urlpatterns = [
    path('link/', include('shortlinks.urls')),
    re_path(r'^$', stub_view, name='test-home'),
]
