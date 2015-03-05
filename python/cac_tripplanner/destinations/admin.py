from django.contrib.gis import admin

from . import models


class DestinationAdmin(admin.OSMGeoAdmin):
    list_display = ('name', 'published', 'address', 'city', 'state', 'zip')
    actions = ('make_published', 'make_unpublished')
    ordering = ('name', )

    default_lon, default_lat = -8370000.00, 4860000.00  # 3857
    default_zoom = 12

    # Override map_template for custom address geocoding behavior
    map_template = 'admin/cac-geocoding-map.html'

    # Include geocoder dependencies
    extra_js = [
        'https://code.jquery.com/jquery-2.1.3.min.js',
        '/static/scripts/vendor/lodash.js',
        '/static/scripts/main/cac/cac.js',
        '/static/scripts/main/cac/search/cac-geocoder.js'
    ]

    def make_published(self, request, queryset):
        queryset.update(published=True)
    make_published.short_description = 'Publish selected destinations'

    def make_unpublished(self, request, queryset):
        queryset.update(published=False)
    make_unpublished.short_description = 'Unpublish selected destinations'


admin.site.register(models.Destination, DestinationAdmin)
