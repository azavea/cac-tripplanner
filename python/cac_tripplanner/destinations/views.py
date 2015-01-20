from django.http import HttpResponse
from djgeojson.serializers import Serializer as GeoJSONSerializer
from models import Destination


def destinations_json(request):
    '''View returning a GeoJSON response with all destinations.'''

    response = HttpResponse(content_type='application/vnd.geo+json')
    destinations = Destination.objects.all().filter(published=True)
    geojson = GeoJSONSerializer().serialize(destinations,
                                            properties=['name',
                                                        'address',
                                                        'city',
                                                        'state',
                                                        'zip',
                                                        'description'],
                                            geometry_field='point')
    response.write(geojson)
    return response
