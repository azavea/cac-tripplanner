import json
import logging
import requests

from django.conf import settings
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import GEOSGeometry, Point
from django.core.exceptions import MultipleObjectsReturned
from django.db import transaction
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from easy_thumbnails.exceptions import InvalidImageFormatError
from image_cropping.utils import get_backend

from .models import (Destination,
                     Event,
                     ExtraDestinationPicture,
                     ExtraEventPicture,
                     Tour,
                     UserFlag,
                     NARROW_IMAGE_DIMENSIONS,
                     WIDE_IMAGE_DIMENSIONS)
from cms.models import Article

logger = logging.getLogger(__name__)


DEFAULT_CONTEXT = {
    'debug': settings.DEBUG,
    'fb_app_id': settings.FB_APP_ID,
    'isochrone_url': settings.ISOCHRONE_URL,
    'routing_url': settings.ROUTING_URL
}

EVENT_CATEGORY = 'Events'


def base_view(request, page, context):
    """
    Base view that sets some variables for JS settings.

    :param request: Request object
    :param page: String representation of the HTML template
    :param context: Additional context
    :returns: A rendered response
    """
    all_context = dict(**DEFAULT_CONTEXT)
    all_context.update(**context)
    return render(request, page, context=all_context)


def home(request):
    # Load one random article
    article = Article.objects.random()
    # Show all destinations, events, and tours
    destinations = list(Destination.objects.published().order_by('priority'))
    events = list(Event.objects.current().order_by('priority', 'start_date'))[:2]
    tours = list(Tour.objects.published().order_by('priority'))
    context = {
        'tab': 'home',
        'article': article,
        'destinations': events + destinations,
        'tours': tours
    }
    if request.GET.get('destination') is not None:
        # If there's a destination in the URL, go right to directions
        context['tab'] = 'map-directions'
    elif request.GET.get('origin') is not None:
        # If there's no destination but there is an origin, go to Explore
        context['tab'] = 'map-explore'

    return base_view(request, 'home.html', context=context)


def explore(request):
    """Enable loading the explore view via URL.

    Explore is still a javascript-defined sub-view of Home, but this enables us to send the message
    to the javascript that it should start on that view even though there's no origin.
    """
    context = {'tab': 'map-explore'}
    return base_view(request, 'home.html', context=context)


def privacy_policy(request):
    context = {'tab': 'home'}
    return base_view(request, 'privacy-policy.html', context=context)


def terms_of_service(request):
    context = {'tab': 'home'}
    return base_view(request, 'terms-of-service.html', context)


def manifest(request):
    """Render the app manifest for a PWA app that can install to homescreen.

    https://developers.google.com/web/fundamentals/engage-and-retain/web-app-manifest/?utm_source=devtools
    """
    return render(request, 'manifest.json', {}, content_type='application/json')


def service_worker(request):
    """Render the service worker for a PWA app that can install to homescreen.

    https://developers.google.com/web/fundamentals/getting-started/primers/service-workers
    """
    # files to cache in either development or production
    cache_files = [
        '/',
        '/static/styles/vendor.css',
        '/static/styles/main.css'
    ]

    # additional files to cache in production
    prod_cache_files = [
        '/static/scripts/vendor.js',
        '/static/scripts/main.js',
        '/static/fontello/css/gpg.css'
    ]

    if not settings.DEBUG:
        cache_files += prod_cache_files

    return render(request,
                  'service-worker.js',
                  {'cache_files': json.dumps(cache_files)},
                  content_type='application/javascript')


def place_detail(request, pk):
    destination = get_object_or_404(Destination.objects.published(), pk=pk)
    more_destinations = Destination.objects.published().exclude(pk=destination.pk)[:3]
    context = dict(tab='explore', destination=destination, more_destinations=more_destinations,
                   **DEFAULT_CONTEXT)
    return base_view(request, 'place-detail.html', context=context)


def event_detail(request, pk):
    event = get_object_or_404(Event.objects.published(), pk=pk)
    more_events = Event.objects.current().exclude(pk=event.pk)[:3]
    context = dict(tab='explore', event=event, more_events=more_events,
                   **DEFAULT_CONTEXT)
    return base_view(request, 'event-detail.html', context=context)


def image_to_url(obj, field_name, size, raw_field_name=''):
    """Helper for converting an image object property to a url for a json response.

    :param obj: Model object with {image} and {image}_raw fields
    :param field_name: String identifier for the image field
    :returns: URL of the image, or an empty string if there is no image
    """
    if not raw_field_name:
        raw_field_name = field_name + '_raw'
    options = {
        'size': size,
        'crop': True,
        'detail': True
    }
    box = getattr(obj, field_name)
    if box:
        options['box'] = box

    try:
        return get_backend().get_thumbnail_url(getattr(obj, raw_field_name), options)
    except InvalidImageFormatError:
        return ''


def set_location_properties(obj, location):
    """Helper to set location-related properties on either destinations or events.

    Events have optional related destination, which is the event location.

    :param obj: Dictionary representation of object to which to add location properties
    :param location: Destination object from which to extract location properties
    :returns: passed obj dictionary, with added properties
    """
    obj['placeID'] = location.pk if location else None
    obj['point'] = json.loads(location.point.json) if location else None
    obj['attributes'] = {
        'City': location.city if location else None,
        'Postal': location.zipcode if location else None,
        'Region': location.state if location else None,
        'StAddr': location.address if location else None
    }
    # convert to format like properties on ESRI geocoder results
    x = obj['point']['coordinates'][0] if location else None
    y = obj['point']['coordinates'][1] if location else None
    obj['extent'] = {'xmax': x, 'xmin': x, 'ymax': y, 'ymin': y}
    obj['location'] = {'x': x, 'y': y}
    return obj


def set_attraction_properties(obj, model, extra_images):
    """Helper to set serialized properties common to destinations and events.

    :param obj: Dictionary representation of object
    :param model: Django model object with the expected properties of an Attraction
    :param extra_images: Filtered queryset of `ExtraImage` related objects to the Attraction
    :returns: Dictionary representation of object, with added properties
    """
    obj['image'] = image_to_url(model, 'image', NARROW_IMAGE_DIMENSIONS)
    obj['wide_image'] = image_to_url(model, 'wide_image', WIDE_IMAGE_DIMENSIONS)
    del obj['image_raw']
    del obj['wide_image_raw']

    # return URLs for extra images, in both narrow and wide formats
    extras_list = []
    wide_extras_list = []
    for extra in extra_images:
        extras_list.append(image_to_url(extra, 'image', NARROW_IMAGE_DIMENSIONS))
        wide_extras_list.append(image_to_url(extra,
                                             'wide_image',
                                             WIDE_IMAGE_DIMENSIONS,
                                             'image_raw'))
    obj['extra_images'] = extras_list
    obj['extra_wide_images'] = wide_extras_list

    obj['activities'] = [a.name for a in obj['activities']]
    # add convenience property for whether destination has cycling
    obj['cycling'] = model.has_activity('cycling')

    return obj


def set_destination_properties(destination):
    """Helper for adding and converting properties in serializing destinations as JSON.

    :param destination: Destination model object
    :returns: Dictionary representation of object, with added properties
    """
    obj = model_to_dict(destination)
    obj['address'] = obj['name']
    obj['categories'] = [c.name for c in obj['categories']]
    obj['is_event'] = False

    extra_images = ExtraDestinationPicture.objects.filter(destination=destination)
    obj = set_attraction_properties(obj, destination, extra_images)
    obj = set_location_properties(obj, destination)
    return obj


def set_event_properties(event):
    """Helper for adding and converting properties in serializing events as JSON.

    :param event: Event model object
    :returns: Dictionary representation of object, with added properties
    """
    obj = model_to_dict(event)
    obj['address'] = event.name

    obj['categories'] = (EVENT_CATEGORY,)  # events are a special category
    obj['start_date'] = timezone.localtime(event.start_date).isoformat()
    obj['end_date'] = timezone.localtime(event.end_date).isoformat()
    obj['is_event'] = True

    extra_images = ExtraEventPicture.objects.filter(event=event)
    obj = set_attraction_properties(obj, event, extra_images)
    # add properties of first related destination, if any
    obj = set_location_properties(obj, event.destinations.first())
    obj['destinations'] = [set_destination_properties(x)
                           for x in event.destinations.all()]

    # if the first related destination belongs to Watershed Alliance, so does this event
    obj['watershed_alliance'] = (event.destinations.first().watershed_alliance
                                 if event.destinations.count() else False)
    return obj


def set_tour_properties(tour):
    """Helper for adding and converting properties in serializing tours as JSON.

    :param tour: Tour model object
    :returns: Dictionary representation of object, with added properties
    """
    obj = model_to_dict(tour)
    obj['destinations'] = [set_destination_properties(x.destination)
                           for x in tour.tour_destinations.all()]
    return obj


class FindReachableDestinations(View):
    """Class based view for fetching isochrone and finding destinations of interest within it."""

    otp_router = 'default'
    isochrone_url = settings.ISOCHRONE_URL
    algorithm = 'accSampling'

    def isochrone(self, payload):
        """Make request to Open Trip Planner for isochrone geometry.

        Take the provided args and return OTP JSON.
        """
        payload['routerId'] = self.otp_router
        payload['algorithm'] = self.algorithm
        headers = {'Accept': 'application/json'}

        # Need to set accept header for isochrone endpoint, or else it will occasionally decide to
        # return a shapefile, although it's supposed to default to geojson.
        isochrone_response = requests.get(self.isochrone_url, params=payload, headers=headers)

        # Parse and traverse JSON from OTP so that we return only geometries
        try:
            # get a feature collection
            json_poly = json.loads(isochrone_response.content.decode('utf-8'))
        except:  # noqa: E722
            # No isochrone found.  Is GTFS loaded?  Is origin within the graph bounds?
            json_poly = json.loads("{}")
        return json_poly

    def get(self, request, *args, **kwargs):
        """When a GET hits this endpoint, calculate an isochrone and find destinations within it.

        Return both the isochrone GeoJSON and the list of matched destinations.
        Can send optional comma-separated `categories` param to filter by destination category.
        """
        params = request.GET.copy()  # make mutable

        # allow a max travelshed size of 60 minutes in a query
        cutoff_sec = int(params.get('cutoffSec', -1))
        if not cutoff_sec or cutoff_sec < 0 or cutoff_sec > 3600:
            return return_400('cutoffSec out of range',
                              'cutoffSec must be greater than 0 and less than 360')

        json_poly = self.isochrone(params)

        # Have a FeatureCollection of MultiPolygons
        if 'features' in json_poly:
            matched_objects = []
            for poly in json_poly['features']:
                geom_str = json.dumps(poly['geometry'])
                geom = GEOSGeometry(geom_str, srid=4326)
                matched_objects = (Destination.objects.filter(published=True, point__within=geom)
                                                      .annotate(distance=Distance('point', geom))
                                                      .order_by('distance', 'priority'))
        else:
            matched_objects = []

        categories = params.get('categories', None)
        if categories:
            matched_objects = matched_objects.filter(categories__name__in=categories.split(','))

        # make locations JSON serializable
        matched_objects = [set_destination_properties(x) for x in matched_objects]

        response = {'matched': matched_objects, 'isochrone': json_poly}
        return JsonResponse(response)


class SearchDestinations(View):
    """View for searching destinations via an http endpoint."""

    def get(self, request, *args, **kwargs):
        """Get destinations that match search queries.

        Must pass either:
          - lat + lon params
          - text param
        Optional:
          - limit param: maximum number of results to return (integer)
          - categories param: comma-separated list of category names to filter to

        A search via text returns destinations, events, and tours that match the name
        A search via lat/lon returns destinations, events, and tours that are
        closest to the search point

        """
        params = request.GET
        lat = params.get('lat', None)
        lon = params.get('lon', None)
        text = params.get('text', None)
        limit = params.get('limit', None)
        categories = params.get('categories', None)

        destinations = Destination.objects.none()
        events = Event.objects.none()
        tours = Tour.objects.none()

        if lat and lon:
            try:
                search_point = Point(float(lon), float(lat), srid=4326)
            except ValueError as e:
                return return_400('Invalid latitude/longitude pair', str(e))
            destinations = (Destination.objects.filter(published=True)
                            .annotate(distance=Distance('point', search_point))
                            .order_by('distance', 'priority'))
        elif text is not None:
            destinations = Destination.objects.filter(published=True,
                                                      name__icontains=text).order_by('priority')

        # get events and filter both events and destinations by category
        if categories:
            categories = categories.split(',')
            if EVENT_CATEGORY in categories:
                categories.remove(EVENT_CATEGORY)
                events = (Event.objects.current()
                          .order_by('priority', 'start_date'))
            destinations = destinations.filter(categories__name__in=categories)
        else:
            events = (Event.objects.current()
                      .order_by('priority', 'start_date'))

        # get tours
        tours = Tour.objects.filter(published=True).order_by('priority')

        if text is not None:
            events = events.filter(name__icontains=text)
            tours = tours.filter(name__icontains=text)

        if limit:
            try:
                limit_int = int(limit)
            except ValueError as e:
                return return_400('Invalid limit, must be an integer', str(e))
            destinations = destinations[:limit_int]
            events = events[:limit_int]
            tours = tours[:limit_int]

        destinations = [set_destination_properties(x) for x in destinations]
        events = [set_event_properties(x) for x in events]
        tours = [set_tour_properties(x) for x in tours]

        response = {'destinations': destinations, 'events': events, 'tours': tours}
        return JsonResponse(response)


def return_400(message, error):
    # Helper to return JSON error messages in a consistent format
    error = {
        'msg': message,
        'error': error
    }
    return JsonResponse(error, status=400)


class UserFlagView(View):
    """POST-only endpoint for recording anonymous user flags on destinations from mobile app.

    Expects POST as JSON with the following fields:
     - api_key: String key that must match setting from server secrets file
     - attraction: ID of the destination or event to flag
     - is_event: true if attraction is an event
     - user_uuid: UUID to anonymously identify user (not associated with anything else)
     - flag: how user has flagged the attraction; must be one of `UserFlag.UserFlags` keys
             (or empty, if unset)
    """

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super(UserFlagView, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        # decode posted body for python 3 support
        try:
            json_data = json.loads(request.body.decode('utf-8'))
        except ValueError as e:
            return return_400('Could not parse JSON', str(e))

        if json_data.get('api_key') != settings.USER_FLAG_API_KEY:
            return return_400('api_key required', 'API key missing or incorrect')

        expected_fields = ('attraction', 'is_event', 'user_uuid', 'flag')
        user_flag_data = {}  # build an object of the cleaned values to use to create flag
        missing_fields_msg = 'Missing expected value(s): '
        missing = False  # flag to check if any of the required fields are missing
        for fld in expected_fields:
            if fld in json_data:
                user_flag_data[fld] = json_data.get(fld, None)
            else:
                missing = True
                missing_fields_msg += fld + ', '
        if missing:
            return return_400(missing_fields_msg, 'Missing required value')

        # parse JSON value to boolean if passed as string
        if type(user_flag_data['is_event']) == 'str':
            user_flag_data['is_event'] = user_flag_data['is_event'] == 'true'

        try:
            attraction_id = user_flag_data.pop('attraction')
            if user_flag_data['is_event']:
                attraction = Event.objects.get(pk=attraction_id)
            else:
                attraction = Destination.objects.get(pk=attraction_id)

            user_flag = UserFlag(attraction=attraction, **user_flag_data)
            # clean model to enforce validation, in particular for the flag choices
            user_flag.full_clean()

            # mark any previous flags from this user for this attraction as 'historic'
            # as a convenience for finding the most recent flag
            with transaction.atomic():
                UserFlag.objects.filter(user_uuid=user_flag_data.get('user_uuid'),
                                        is_event=user_flag_data.get('is_event'),
                                        object_id=attraction.pk).update(historic=True)
                user_flag.save()
        except (Event.DoesNotExist, Destination.DoesNotExist, MultipleObjectsReturned):
            return return_400('No attraction found that matches given ID ' + str(attraction_id),
                              'Attraction not found')

        return JsonResponse({'ok': True})
