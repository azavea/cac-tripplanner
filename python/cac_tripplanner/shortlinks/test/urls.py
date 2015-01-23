from django.conf.urls import patterns, url, include

urlpatterns = patterns(
    '',
    url(r'^link/', include('shortlinks.urls')),
    url(r'^$', 'shortlinks.test.views.stub_view', name='test-home'),
)
