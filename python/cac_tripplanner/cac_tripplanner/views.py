import json

from django.views.generic import View
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render_to_response
from django.template import RequestContext

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from requests import get

from destinations.models import Destination

def home(request):
    print request.META['REMOTE_ADDR']
    return render_to_response('home.html', context_instance=RequestContext(request))


def map(request):
    return render_to_response('map.html', context_instance=RequestContext(request))


class Reachable(View):
    """Class based view for finding destinations of interest within the calculated isochrone"""
    # TODO: make decisions on acceptable ranges of values that this endpoint will support

    otp_router = 'default'
    otp_url = 'http://192.168.8.26:8080/otp/routers/{router}/isochrone'.format(router=otp_router)
    algorithm = 'accSampling'

    def isochrone(self, lat, lng, mode, date, time, max_travel_time, max_walk_distance):
        """Make request to Open Trip Planner for isochrone geometry - convert it to GDAL Polygon"""
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
        isochrone_response = get(self.otp_url, params=payload)
        print('pay', payload)

        # Parse and traverse JSON from OTP so that we return only geometries
        json_poly = json.loads(isochrone_response.content)[0]['geometry']['geometries']

        # Iterate through the returned geometries and convert them to proper OGR geoms
        polygons = []
        for _, poly in enumerate(json_poly):
            polygons.append(GEOSGeometry(json.dumps(poly)))
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

        matched_objects = Destination.objects.filter(point__within=iso)
        return HttpResponse('{{"matched": "{0}"}}'.format(matched_objects), 'application/json')


