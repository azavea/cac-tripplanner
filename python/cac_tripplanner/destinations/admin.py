from django.conf import settings
from django.contrib import admin, gis

from image_cropping import ImageCroppingMixin

from .forms import DestinationForm, EventForm, ExtraImagesForm
from .models import (Destination,
                     DestinationUserFlags,
                     Event,
                     #EventUserFlags,
                     ExtraDestinationPicture,
                     ExtraEventPicture)


class ExtraDestinationImagesInline(ImageCroppingMixin, admin.StackedInline):

    form = ExtraImagesForm
    list_display = ('image', 'wide_image', 'image_raw')
    model = ExtraDestinationPicture
    extra = 0


class ExtraEventImagesInline(ImageCroppingMixin, admin.StackedInline):

    form = ExtraImagesForm
    list_display = ('image', 'wide_image', 'image_raw')
    model = ExtraEventPicture
    extra = 0


class DestinationAdmin(ImageCroppingMixin, gis.admin.OSMGeoAdmin):
    form = DestinationForm

    list_display = ('name', 'published', 'priority', 'address', 'city', 'state', 'zipcode')
    actions = ('make_published', 'make_unpublished')
    ordering = ('name', )
    # To change field display order, define them all here.
    # Default is order defined in model, but due to inheritance, cannot reorder across
    # relationship with model field ordering alone.
    fields = ('name', 'website_url', 'description', 'image', 'image_raw', 'wide_image',
              'wide_image_raw', 'published',
              'priority', 'accessible', 'categories', 'activities', 'city', 'state', 'zipcode',
              'address', 'point', 'watershed_alliance')

    default_lon, default_lat = -8370000.00, 4860000.00  # 3857
    default_zoom = 12

    inlines = [ExtraDestinationImagesInline]

    # Override map_template for custom address geocoding behavior
    map_template = 'admin/cac-geocoding-map.html'

    # Include geocoder dependencies
    jquery = 'https://code.jquery.com/jquery-3.2.1.min.js'
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


class EventAdmin(ImageCroppingMixin, admin.ModelAdmin):
    form = EventForm

    fields = ('name', 'website_url', 'description', 'image', 'image_raw', 'wide_image',
              'wide_image_raw', 'published', 'priority', 'accessible', 'activities',
              'start_date', 'end_date', 'destination')
    list_display = ('name', 'published', 'priority', )
    actions = ('make_published', 'make_unpublished', )
    ordering = ('name', )

    inlines = [ExtraEventImagesInline]

    def make_published(self, request, queryset):
        queryset.update(published=True)
    make_published.short_description = 'Publish selected events'

    def make_unpublished(self, request, queryset):
        queryset.update(published=False)
    make_unpublished.short_description = 'Unpublish selected events'


class DestinationUserFlagsAdmin(admin.ModelAdmin):

    ordering = ('name',)
    list_display = ('name', 'been', 'want_to_go', 'liked', 'not_interested',)
    readonly_fields = ('name', 'been', 'want_to_go', 'liked', 'not_interested',)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    # FIXME: hide 'change' button, but if set this, whole row disappears
    #def has_change_permission(self, request):
    #    return False


admin.site.register(Destination, DestinationAdmin)
admin.site.register(Event, EventAdmin)

admin.site.register(DestinationUserFlags, DestinationUserFlagsAdmin)
