from django.conf import settings
from django.contrib.gis import admin

from .forms import DestinationForm
from .models import Destination


class DestinationAdmin(admin.OSMGeoAdmin):
    form = DestinationForm

    list_display = ('name', 'published', 'priority', 'address', 'city', 'state', 'zip')
    actions = ('make_published', 'make_unpublished')
    ordering = ('name', )

    default_lon, default_lat = -8370000.00, 4860000.00  # 3857
    default_zoom = 12

    # Override map_template for custom address geocoding behavior
    map_template = 'admin/cac-geocoding-map.html'

    # Override configurable URL for openlayers.js to support SSL
    # default is: 'http://openlayers.org/api/2.13.1/OpenLayers.js'
    openlayers_url = 'https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/OpenLayers.js'

    # Include geocoder dependencies
    jquery = 'https://code.jquery.com/jquery-2.1.3.min.js'
    if settings.DEBUG:
        extra_js = [
            jquery,
            '/static/scripts/vendor/lodash.js',
            '/static/scripts/main/cac/cac.js',
            '/static/scripts/main/cac/search/cac-search-params.js',
            '/static/scripts/main/cac/search/cac-geocoder.js'
        ]
    else:
        extra_js = [
            jquery,
            '/static/scripts/vendor.js',
            '/static/scripts/main.js'
        ]

    def make_published(self, request, queryset):
        queryset.update(published=True)
    make_published.short_description = 'Publish selected destinations'

    def make_unpublished(self, request, queryset):
        queryset.update(published=False)
    make_unpublished.short_description = 'Unpublish selected destinations'


admin.site.register(Destination, DestinationAdmin)
