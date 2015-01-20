from django.contrib.gis import admin

from . import models


class DestinationAdmin(admin.OSMGeoAdmin):
    list_display = ('name', 'published', 'address', 'city', 'state', 'zip')
    actions = ('make_published', 'make_unpublished')
    ordering = ('name', )

    default_lon, default_lat = -8370000.00, 4860000.00  # 3857
    default_zoom = 12

    def make_published(self, request, queryset):
        queryset.update(published=True)
    make_published.short_description = 'Publish selected destinations'

    def make_unpublished(self, request, queryset):
        queryset.update(published=False)
    make_unpublished.short_description = 'Unpublish selected destinations'


admin.site.register(models.Destination, DestinationAdmin)
