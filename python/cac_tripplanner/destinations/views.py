from datetime import datetime
import json

from pytz import timezone

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon, Point
from django.core import serializers
from django.forms.models import model_to_dict
from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.template import RequestContext
from django.views.generic import View

import requests

from cac_tripplanner.settings import OTP_URL
from .models import Destination, FeedEvent


def map(request):
    routing_url = OTP_URL.format(router='default') + 'plan'
    context = RequestContext(request, dict(routing_url=routing_url))
    return render_to_response('map.html', context_instance=context)


class FindReachableDestinations(View):
    """Class based view for fetching isochrone and finding destinations of interest within it"""
    # TODO: make decisions on acceptable ranges of values that this endpoint will support

    otp_router = 'default'
    isochrone_url = OTP_URL.format(router=otp_router) + 'isochrone'
    algorithm = 'accSampling'

    def isochrone(self, lat, lng, mode, date, time, max_travel_time, max_walk_distance):
        """Make request to Open Trip Planner for isochrone geometry with the provided args
        and return OTP JSON"""
        payload = {
            'routerId': self.otp_router,
            'fromPlace': lat + ',' + lng,
            'mode': mode,
            'date': date,
            'time': time,
            'cutoffSec': max_travel_time,
            'maxWalkDistance': max_walk_distance,
            'algorithm': self.algorithm
        }
        isochrone_response = requests.get(self.isochrone_url, params=payload)

        # Parse and traverse JSON from OTP so that we return only geometries
        try:
            json_poly = json.loads(isochrone_response.content)[0]['geometry']['geometries']
        except:
            # No isochrone found.  Is GTFS loaded?  Is origin within the graph bounds?
            json_poly = json.loads("{}")
        return json_poly

    def image_to_url(self, dest_dict, field_name):
        """Helper for converting an image object to a url for a json response

        :param dict_obj: Dictionary representation of a Destination object
        :param field_name: String identifier for the image field
        :returns: URL of the image, or an empty string if there is no image
        """
        image = dest_dict.get(field_name)
        return image.url if image else ''

    def get(self, request, *args, **kwargs):
        """When a GET hits this endpoint, calculate an isochrone and find destinations within it.
        Return both the isochrone GeoJSON and the list of matched destinations."""
        params = request.GET

        json_poly = self.isochrone(
            lat=params.get('coords[lat]'),
            lng=params.get('coords[lng]'),
            mode=params.get('mode'),
            date=params.get('date'),
            time=params.get('time'),
            max_travel_time=params.get('maxTravelTime'),
            max_walk_distance=params.get('maxWalkDistance')
        )

        # Coerce to multipolygon
        polygons = [GEOSGeometry(json.dumps(poly)) for poly in json_poly]
        iso = MultiPolygon(polygons)

        matched_objects = Destination.objects.filter(point__within=iso, published=True)

        # make locations JSON serializable
        matched_objects = [model_to_dict(x) for x in matched_objects]
        for obj in matched_objects:
            obj['point'] = json.loads(obj['point'].json)
            obj['image'] = self.image_to_url(obj, 'image')
            obj['wide_image'] = self.image_to_url(obj, 'wide_image')

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
        output_fields = ('name', 'description', 'point', 'address', 'city', 'state', 'zip')

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
        data = serializers.serialize('json', results, fields=output_fields)
        return HttpResponse(data, 'application/json')

class FeedEvents(View):
    """ API endpoint for the FeedEvent model """

    def get(self, request, *args, **kwargs):
        """ GET 20 most recent feed events that are published

        TODO: Additional filtering, dynamic limits?

        """
        utc = timezone('UTC')
        epoch = utc.localize(datetime(1970, 1, 1))

        results = FeedEvent.objects.published().order_by('-publication_date')[:20]
        response = [model_to_dict(x) for x in results]
        for obj in response:
            pnt = obj['point']
            obj['point'] = json.loads(pnt.json)
            dt = obj['publication_date']
            obj['publication_date'] = (dt - epoch).total_seconds()
        return HttpResponse(json.dumps(response), 'application/json')
