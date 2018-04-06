import json
import requests

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry, Point
from django.forms.models import model_to_dict
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views.generic import View

from image_cropping.utils import get_backend

from .models import Destination, Event
from cms.models import Article


DEFAULT_CONTEXT = {
    'debug': settings.DEBUG,
    'fb_app_id': settings.FB_APP_ID,
    'isochrone_url': settings.ISOCHRONE_URL,
    'routing_url': settings.ROUTING_URL
}

EVENT_CATEGORY = 'Events'


def base_view(request, page, context):
    """
    Base view that sets some variables for JS settings

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
    # Show all destinations
    destinations = list(Destination.objects.published().order_by('priority'))
    events = list(Event.objects.current().order_by('priority', 'start_date'))[:2]
    context = {
        'tab': 'home',
        'article': article,
        'destinations': events + destinations
    }
    if request.GET.get('destination') is not None:
        # If there's a destination in the URL, go right to directions
        context['tab'] = 'map-directions'
    elif request.GET.get('origin') is not None:
        # If there's no destination but there is an origin, go to Explore
        context['tab'] = 'map-explore'

    return base_view(request, 'home.html', context=context)


def explore(request):
    """
    Enables loading the explore view via URL.
    Explore is still a javascript-defined sub-view of Home, but this enables us to send the message
    to the javascript that it should start on that view even though there's no origin.
    """
    context = {'tab': 'map-explore'}
    return base_view(request, 'home.html', context=context)


def manifest(request):
    """Render the app manifest for a PWA app that can install to homescreen

    https://developers.google.com/web/fundamentals/engage-and-retain/web-app-manifest/?utm_source=devtools
    """
    return render(request, 'manifest.json', {})


def service_worker(request):
    """Render the service worker for a PWA app that can install to homescreen

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


def image_to_url(attraction, field_name, size):
    """Helper for converting an image object to a url for a json response

    :param attraction: Attraction object
    :param field_name: String identifier for the image field
    :returns: URL of the image, or an empty string if there is no image
    """

    raw_field_name = field_name + '_raw'
    return get_backend().get_thumbnail_url(getattr(attraction, raw_field_name), {
                                           'box': getattr(attraction, field_name),
                                           'size': size,
                                           'crop': True,
                                           'detail': True})


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


def set_destination_properties(destination):
    """Helper for adding and converting properties in serializing destinations as JSON

    :param destination: Destination model object
    :returns: Dictionary representation of object, with added properties
    """
    obj = model_to_dict(destination)
    obj['address'] = obj['name']

    obj['image'] = image_to_url(destination, 'image', (310, 155))
    obj['wide_image'] = image_to_url(destination, 'wide_image', (680, 400))
    del obj['image_raw']
    del obj['wide_image_raw']

    obj['categories'] = [c.name for c in obj['categories']]
    obj['activities'] = [a.name for a in obj['activities']]
    # add convenience property for whether destination has cycling
    obj['cycling'] = destination.has_activity('cycling')
    obj['is_event'] = False

    obj = set_location_properties(obj, destination)
    return obj


def set_event_properties(event):
    """Helper for adding and converting properties in serializing events as JSON

    :param event: Event model object
    :returns: Dictionary representation of object, with added properties
    """
    obj = model_to_dict(event)
    obj['address'] = event.name

    obj['image'] = image_to_url(obj, 'image', (310, 155))
    obj['wide_image'] = image_to_url(obj, 'wide_image', (680, 400))
    del obj['image_raw']
    del obj['wide_image_raw']

    obj['activities'] = [a.name for a in obj['activities']]
    obj['categories'] = (EVENT_CATEGORY,)  # events are a special category
    obj['start_date'] = event.start_date.isoformat()
    obj['end_date'] = event.end_date.isoformat()
    # add convenience property for whether event has cycling
    obj['cycling'] = event.has_activity('cycling')
    obj['is_event'] = True

    # add properties of related destination, if any
    obj = set_location_properties(obj, event.destination)

    # if related destination belongs to Watershed Alliance, so does this event
    obj['watershed_alliance'] = event.destination.watershed_alliance if event.destination else False
    return obj


class FindReachableDestinations(View):
    """Class based view for fetching isochrone and finding destinations of interest within it"""

    otp_router = 'default'
    isochrone_url = settings.ISOCHRONE_URL
    algorithm = 'accSampling'

    def isochrone(self, payload):
        """Make request to Open Trip Planner for isochrone geometry with the provided args
        and return OTP JSON"""

        payload['routerId'] = self.otp_router
        payload['algorithm'] = self.algorithm
        headers = {'Accept': 'application/json'}

        # Need to set accept header for isochrone endpoint, or else it will occasionally decide to
        # return a shapefile, although it's supposed to default to geojson.
        isochrone_response = requests.get(self.isochrone_url, params=payload, headers=headers)

        # Parse and traverse JSON from OTP so that we return only geometries
        try:
            # get a feature collection
            json_poly = json.loads(isochrone_response.content)
        except:  # noqa: E722
            # No isochrone found.  Is GTFS loaded?  Is origin within the graph bounds?
            json_poly = json.loads("{}")
        return json_poly

    def get(self, request, *args, **kwargs):
        """When a GET hits this endpoint, calculate an isochrone and find destinations within it.
        Return both the isochrone GeoJSON and the list of matched destinations.

        Can send optional comma-separated `categories` param to filter by destination category."""
        params = request.GET.copy()  # make mutable

        # allow a max travelshed size of 60 minutes in a query
        cutoff_sec = int(params.get('cutoffSec', -1))
        if not cutoff_sec or cutoff_sec < 0 or cutoff_sec > 3600:
            return HttpResponse(status=400,
                                reason='cutoffSec must be greater than 0 and less than 360')

        json_poly = self.isochrone(params)

        # Have a FeatureCollection of MultiPolygons
        if 'features' in json_poly:
            matched_objects = []
            for poly in json_poly['features']:
                geom_str = json.dumps(poly['geometry'])
                geom = GEOSGeometry(geom_str)
                matched_objects = (Destination.objects.filter(published=True, point__within=geom)
                                                      .distance(geom)
                                                      .order_by('distance', 'priority'))
        else:
            matched_objects = []

        categories = params.get('categories', None)
        if categories:
            matched_objects = matched_objects.filter(categories__name__in=categories.split(','))

        # make locations JSON serializable
        matched_objects = [set_destination_properties(x) for x in matched_objects]

        response = {'matched': matched_objects, 'isochrone': json_poly}
        return HttpResponse(json.dumps(response), 'application/json')


class SearchDestinations(View):
    """ View for searching destinations via an http endpoint """

    def get(self, request, *args, **kwargs):
        """ GET destinations that match search queries

        Must pass either:
          - lat + lon params
          - text param
        Optional:
          - limit param: maximum number of results to return (integer)
          - categories param: comma-separated list of destination category names to filter to

        A search via text returns destinations and events that match the destination name
        A search via lat/lon returns destinations and events that are closest to the search point

        """
        params = request.GET
        lat = params.get('lat', None)
        lon = params.get('lon', None)
        text = params.get('text', None)
        limit = params.get('limit', None)
        categories = params.get('categories', None)

        destinations = Destination.objects.none()
        events = Event.objects.none()

        if lat and lon:
            try:
                search_point = Point(float(lon), float(lat))
            except ValueError as e:
                error = json.dumps({
                    'msg': 'Invalid latitude/longitude pair',
                    'error': str(e),
                })
                return HttpResponse(error, 'application/json')
            destinations = (Destination.objects.filter(published=True)
                            .distance(search_point)
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

        if text is not None:
                events = events.filter(name__icontains=text)

        if limit:
            try:
                limit_int = int(limit)
            except ValueError as e:
                error = json.dumps({
                    'msg': 'Invalid limit, must be an integer',
                    'error': str(e),
                })
                return HttpResponse(error, 'application/json')
            destinations = destinations[:limit_int]
            events = events[:limit_int]

        destinations = [set_destination_properties(x) for x in destinations]
        events = [set_event_properties(x) for x in events]

        response = {'destinations': destinations, 'events': events}
        return HttpResponse(json.dumps(response), 'application/json')
