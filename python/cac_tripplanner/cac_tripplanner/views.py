import json

from django.views.generic import View
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render_to_response
from django.template import RequestContext

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
import requests

from .settings import secrets as context_dependent_config
from destinations.models import Destination

def home(request):
    print request.META['REMOTE_ADDR']
    return render_to_response('home.html', context_instance=RequestContext(request))


def map(request):
    return render_to_response('map.html', context_instance=RequestContext(request))


class FindReachableDestinations(View):
    """Class based view for finding destinations of interest within the calculated isochrone"""
    # TODO: make decisions on acceptable ranges of values that this endpoint will support

    otp_router = 'default'
    isochrone_url = context_dependent_config['otp_url'].format(router=otp_router) + 'isochrone'
    algorithm = 'accSampling'

    def isochrone(self, lat, lng, mode, date, time, max_travel_time, max_walk_distance):
        """Make request to Open Trip Planner for isochrone geometry with the provided args
        Take OTP JSON and convert it to GDAL MultiPolygon and return it"""
        payload = {
            'routerId': self.otp_router,
            'fromPlace': lat + ',' + lng,
            'mode': (',').join(mode),
            'date': date,
            'time': time,
            'cutoffSec': max_travel_time,
            'maxWalkDistance': max_walk_distance,
            'algorithm': self.algorithm
        }
        isochrone_response = requests.get(self.isochrone_url, params=payload)

        # Parse and traverse JSON from OTP so that we return only geometries
        json_poly = json.loads(isochrone_response.content)[0]['geometry']['geometries']
        polygons = [GEOSGeometry(json.dumps(poly)) for poly in json_poly]

        # Coerce to multipolygon
        isochrone_multipoly = MultiPolygon(polygons)
        return isochrone_multipoly


    def get(self, request, *args, **kwargs):
        """When a GET hits this endpoint, calculate an isochrone and find destinations within it"""
        params = request.GET

        iso = self.isochrone(
            lat=params.get('coords[lat]'),
            lng=params.get('coords[lng]'),
            mode=params.getlist('mode[]'),
            date=params.get('date'),
            time=params.get('time'),
            max_travel_time=params.get('maxTravelTime'),
            max_walk_distance=params.get('maxWalkDistance')
        )

        matched_objects = Destination.objects.filter(point__within=iso, published=True)
        return HttpResponse('{{"matched": "{0}"}}'.format(matched_objects), 'application/json')
