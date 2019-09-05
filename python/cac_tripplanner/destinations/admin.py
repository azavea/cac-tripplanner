import logging
from operator import itemgetter

from django.conf import settings
from django.contrib import admin, gis

from image_cropping import ImageCroppingMixin

from cac_tripplanner.publish_utils import PublishableMixin

from .forms import (DestinationForm,
                    EventForm,
                    EventDestinationForm,
                    ExtraImagesForm,
                    TourDestinationForm,
                    TourForm)
from .models import (Destination,
                     DestinationUserFlags,
                     EventDestination,
                     Event,
                     EventUserFlags,
                     ExtraDestinationPicture,
                     ExtraEventPicture,
                     TourDestination,
                     Tour)

logger = logging.getLogger(__name__)


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


class EventDestinationsInline(admin.StackedInline):

    form = EventDestinationForm
    model = EventDestination
    extra = 1


class TourDestinationsInline(admin.StackedInline):

    form = TourDestinationForm
    model = TourDestination
    extra = 1


class DestinationAdmin(ImageCroppingMixin, PublishableMixin, gis.admin.OSMGeoAdmin):
    form = DestinationForm

    list_display = ('name', 'published', 'priority', 'address', 'city', 'state', 'zipcode')
    ordering = ('name', )
    """To change field display order, define them all here.
    Default is order defined in model, but due to inheritance, cannot reorder across
    relationship with model field ordering alone."""
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
    # Use Django admin jquery
    jquery = '/static/admin/js/vendor/jquery/jquery.js'
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


class EventAdmin(ImageCroppingMixin, PublishableMixin, admin.ModelAdmin):
    form = EventForm

    fields = ('name', 'website_url', 'description', 'image', 'image_raw', 'wide_image',
              'wide_image_raw', 'published', 'priority', 'accessible', 'activities',
              'start_date', 'end_date', )
    list_display = ('name', 'published', 'priority', )
    ordering = ('name', )

    inlines = [ExtraEventImagesInline, EventDestinationsInline]

    def save_formset(self, request, form, formset, change):

        # save without committing to be able to delete any removed EventDestinations
        formset.save(commit=False)
        for obj in formset.deleted_objects:
            obj.delete()

        # commit save here to assign IDs to any newly added EventDestinations
        instances = formset.save(commit=True)

        # Normalize the ordering of the destinations
        event_id = form.instance.id
        # get a list of dicts with EventDestination 'id' and 'order' properties
        last_destinations = list(EventDestination.objects.filter(
            related_event_id=event_id).values('id', 'order'))
        # Retain the current formset order as a third dict property
        for formset_order, dest in enumerate(last_destinations):
            dest['formset_order'] = formset_order

        # Update the order with any changed formset value
        for instance in instances:
            for d in last_destinations:
                if d['id'] == instance.id:
                    d['order'] = instance.order
                    break

        # Sort destinations by 1) newly assigned order then 2) last (formset) order.
        # This means multiple destinations given the same order will be ordered
        # secondarily based on their position in the inline formset, top to bottom.
        resorted = sorted(last_destinations, key=itemgetter('order', 'formset_order'))

        # Reassign order values so that they are normalized to
        # start at 1, increment by 1, and not repeat or skip any integers.
        for normalized_order, dest in enumerate(resorted):
            new_order = normalized_order + 1
            # update objects that need their order changed
            if dest['order'] != new_order:
                EventDestination.objects.filter(id=dest['id']).update(order=new_order)

        form.save_m2m()


class AttractionUserFlagsAdmin(admin.ModelAdmin):

    list_display = ('name', 'been', 'want_to_go', 'liked', 'not_interested',)
    readonly_fields = ('name', 'been', 'want_to_go', 'liked', 'not_interested',)
    ordering = ('name',)
    list_display_links = None
    actions = None

    def has_add_permission(self, request):
        return False  # hide 'add' button

    def has_delete_permission(self, request, obj=None):
        return False  # hide 'delete' button


class TourAdmin(PublishableMixin, admin.ModelAdmin):

    form = TourForm
    inlines = [TourDestinationsInline]
    list_display = ('name', 'published', 'priority')
    ordering = ('name',)

    def save_formset(self, request, form, formset, change):
        # save without committing to be able to delete any removed TourDestinations
        formset.save(commit=False)
        for obj in formset.deleted_objects:
            obj.delete()

        # commit save here to assign IDs to any newly added TourDestinations
        instances = formset.save(commit=True)

        # Normalize the ordering of the destinations
        tour_id = form.instance.id
        # get a list of dicts with TourDestination 'id' and 'order' properties
        last_destinations = list(TourDestination.objects.filter(
            related_tour_id=tour_id).values('id', 'order'))
        # Retain the current formset order as a third dict property
        for formset_order, dest in enumerate(last_destinations):
            dest['formset_order'] = formset_order

        # Update the order with any changed formset value
        for instance in instances:
            for d in last_destinations:
                if d['id'] == instance.id:
                    d['order'] = instance.order
                    break

        # Sort destinations by 1) newly assigned order then 2) last (formset) order.
        # This means multiple destinations given the same order will be ordered
        # secondarily based on their position in the inline formset, top to bottom.
        resorted = sorted(last_destinations, key=itemgetter('order', 'formset_order'))

        # Reassign order values so that they are normalized to
        # start at 1, increment by 1, and not repeat or skip any integers.
        for normalized_order, dest in enumerate(resorted):
            new_order = normalized_order + 1
            # update objects that need their order changed
            if dest['order'] != new_order:
                TourDestination.objects.filter(id=dest['id']).update(order=new_order)

        form.save_m2m()


admin.site.register(Destination, DestinationAdmin)
admin.site.register(Event, EventAdmin)

admin.site.register(DestinationUserFlags, AttractionUserFlagsAdmin)
admin.site.register(EventUserFlags, AttractionUserFlagsAdmin)

admin.site.register(Tour, TourAdmin)
