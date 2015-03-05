{% extends 'gis/admin/osm.js' %}

{% block extra_layers %}

var $address = $('[name=address]');
var module = {{ module }};
var map = module.map;
var projLatLng = new OpenLayers.Projection('EPSG:4326');

// See the following link for the reason why 3857 doesn't work here without some tweaking:
// http://docs.openlayers.org/library/spherical_mercator.html#sphericalmercator-and-epsg-aliases
var projWM = new OpenLayers.Projection('EPSG:900913');
var geocodeThrottleMillis = 500;

$address.on('input', _.debounce(function () {
    CAC.Search.Geocoder.search($address.val()).then(function (location) {
        var geom = location.feature.geometry;
        var point = new OpenLayers.Geometry.Point(geom.x, geom.y).transform(projLatLng, projWM);
        var vectorLayer = module.layers.vector;
        vectorLayer.addFeatures([new OpenLayers.Feature.Vector(point)]);
        map.zoomToExtent(vectorLayer.getDataExtent());
    });
}, geocodeThrottleMillis));

{% endblock %}
