from datetime import datetime
from pytz import timezone
import json
import requests

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry, Point
from django.forms.models import model_to_dict
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views.generic import View

from .models import Destination, FeedEvent
from cms.models import Article


DEFAULT_CONTEXT = {
    'debug': settings.DEBUG,
    'fb_app_id': settings.FB_APP_ID,
    'routing_url': settings.ROUTING_URL
}


def base_view(request, page, context):
    """
    Base view that sets the OTP routing_url variable and Facebook app ID

    :param request: Request object
    :param page: String representation of the HTML template
    :param context: Additional context
    :returns: A rendered response
    """
    all_context = dict(**DEFAULT_CONTEXT)
    all_context.update(**context)
    return render(request, page, context=all_context)


def home(request):
    if request.GET.get('destination') is not None:
        # If there's a destination in the URL, go right to directions
        context = {'tab': 'map'}
    elif request.GET.get('origin') is not None:
        # If there's no destination but there is an origin, go to Explore
        context = {'tab': 'explore'}
    else:
        # Otherwise show the home view
        # Show one random article
        article = Article.objects.random()
        # Show all destinations, in random order
        destinations = Destination.objects.order_by('?').all()
        context = {
            'tab': 'home',
            'article': article,
            'destinations': destinations
        }
    return base_view(request, 'home.html', context=context)


def directions(request):
    """
    The directions view

    :param request: Request object
    :returns: A rendered response
    """
    return base_view(request, 'directions.html')


def place_detail(request, pk):
    destination = get_object_or_404(Destination.objects.published(), pk=pk)
    more_destinations = Destination.objects.published().order_by('?').exclude(pk=destination.pk)[:3]
    context = dict(tab='explore', destination=destination, more_destinations=more_destinations,
                   **DEFAULT_CONTEXT)
    return base_view(request, 'place-detail.html', context=context)


def image_to_url(dest_dict, field_name):
    """Helper for converting an image object to a url for a json response

    :param dict_obj: Dictionary representation of a Destination object
    :param field_name: String identifier for the image field
    :returns: URL of the image, or an empty string if there is no image
    """
    image = dest_dict.get(field_name)
    return image.url if image else ''


class FindReachableDestinations(View):
    """Class based view for fetching isochrone and finding destinations of interest within it"""
    # TODO: make decisions on acceptable ranges of values that this endpoint will support

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
        except:
            # No isochrone found.  Is GTFS loaded?  Is origin within the graph bounds?
            json_poly = json.loads("{}")
        return json_poly

    def get(self, request, *args, **kwargs):
        """When a GET hits this endpoint, calculate an isochrone and find destinations within it.
        Return both the isochrone GeoJSON and the list of matched destinations."""
        params = request.GET.copy()  # make mutable

        json_poly = self.isochrone(params)

        # Have a FeatureCollection of MultiPolygons
        if 'features' in json_poly:
            matched_objects = []
            for poly in json_poly['features']:
                geom_str = json.dumps(poly['geometry'])
                geom = GEOSGeometry(geom_str)
                matched_objects = (Destination.objects.filter(published=True)
                                                      .distance(geom)
                                                      .order_by('distance'))
        else:
            matched_objects = []

        # make locations JSON serializable
        matched_objects = [model_to_dict(x) for x in matched_objects]
        for obj in matched_objects:
            obj['point'] = json.loads(obj['point'].json)
            obj['image'] = image_to_url(obj, 'image')
            obj['wide_image'] = image_to_url(obj, 'wide_image')

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
          - limit param

        A search via text will return destinations that match the destination name
        A search via lat/lon will return destinations that are closest to the search point

        """
        params = request.GET
        lat = params.get('lat', None)
        lon = params.get('lon', None)
        text = params.get('text', None)
        limit = params.get('limit', None)

        results = []
        if lat and lon:
            try:
                searchPoint = Point(float(lon), float(lat))
            except ValueError as e:
                error = json.dumps({
                    'msg': 'Invalid latitude/longitude pair',
                    'error': str(e),
                })
                return HttpResponse(error, 'application/json')
            results = (Destination.objects.filter(published=True)
                       .distance(searchPoint)
                       .order_by('distance'))
        elif text is not None:
            results = Destination.objects.filter(published=True, name__icontains=text)
        if limit:
            try:
                limit_int = int(limit)
            except ValueError as e:
                error = json.dumps({
                    'msg': 'Invalid limit, must be an integer',
                    'error': str(e),
                })
                return HttpResponse(error, 'application/json')
            results = results[:limit_int]

        data = [model_to_dict(x) for x in results]
        for obj in data:
            obj['point'] = json.loads(obj['point'].json)
            obj['image'] = image_to_url(obj, 'image')
            obj['wide_image'] = image_to_url(obj, 'wide_image')
            # convert to format like properties on ESRI geocoder results
            extent = {
                'xmax': obj['point']['coordinates'][0],
                'xmin': obj['point']['coordinates'][0],
                'ymax': obj['point']['coordinates'][1],
                'ymin': obj['point']['coordinates'][1]
            }
            obj['extent'] = extent
            feature = {
                'attributes': {
                    'City': obj['city'],
                    'Postal': obj['zip'],
                    'Region': obj['state'],
                    'StAddr': obj['address']
                }, 'geometry': {
                    'x': obj['point']['coordinates'][0],
                    'y': obj['point']['coordinates'][1]
                }
            }
            obj['feature'] = feature

        response = {'destinations': data}
        return HttpResponse(json.dumps(response), 'application/json')


class FeedEvents(View):
    """ API endpoint for the FeedEvent model """

    def get(self, request, *args, **kwargs):
        """ GET 20 most recent feed events that are published

        TODO: Additional filtering
        """
        utc = timezone('UTC')
        epoch = utc.localize(datetime(1970, 1, 1))

        try:
            limit = int(request.GET.get('limit'))
        except (ValueError, TypeError):
            limit = settings.HOMEPAGE_RESULTS_LIMIT

        results = FeedEvent.objects.published().order_by('end_date')[:limit]
        response = [model_to_dict(x) for x in results]
        for obj in response:
            pnt = obj['point']
            obj['point'] = json.loads(pnt.json)
            dt = obj['publication_date']
            obj['publication_date'] = (dt - epoch).total_seconds()
            dt = obj['end_date']
            obj['end_date'] = (dt - epoch).total_seconds()
        return HttpResponse(json.dumps(response), 'application/json')
