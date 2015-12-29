CAC.Map.OverlaysControl = (function ($, cartodb, L, Utils) {
    'use strict';

    var defaults = {};

    var bikeShareFeatureGroup = null;
    var eventsFeatureGroup = null;

    function OverlaysControl(options) {
        this.options = $.extend({}, defaults, options);
    }

    OverlaysControl.prototype.bikeShareOverlay = bikeShareOverlay;
    OverlaysControl.prototype.bikeRoutesOverlay = bikeRoutesOverlay;
    OverlaysControl.prototype.nearbyEventsOverlay = nearbyEventsOverlay;

    return OverlaysControl;

    function bikeShareOverlay() {
        bikeShareFeatureGroup = cartodb.L.featureGroup([]);
        $.ajax({
            // TODO: drop CORS proxy when endpoint allows CORS
            //contentType: 'application/json',
            url: 'http://cors.io/?u=https://www.rideindego.com/stations/json/',
            success: function (data) {
                data = JSON.parse(data);
                $.each(data.features, function (i, share) {
                    bikeShareFeatureGroup.addLayer(getBikeShareMarker(share));
                });
            }
        });
        return bikeShareFeatureGroup;
    }

    function bikeRoutesOverlay(map) {
        var layerGroup = cartodb.L.featureGroup([]);
        var url = 'https://cac-tripplanner.cartodb.com/api/v2/viz/501dbdc8-f4ea-11e4-8c9e-0e018d66dc29/viz.json';
        // TODO: fix attribution
        // cartodb.js does not allow for changing the layer attribution, and has lso somehow
        // broken the setAttribute method on the layer object.
        //var attribution = ['Bike routes data:',
        //                   '<a href="http://www.dvrpc.org/mapping/data.htm">DVRPC</a>,',
        //                   '<a href="https://www.opendataphilly.org/dataset/bike-network">City of Philadelphia</a>'
        //                   ].join(' ');
        cartodb.createLayer(map, url).on('done', function(layer) {
            layerGroup.addLayer(layer);
            // Wait until layer has loaded to bring it to front.  Otherwise, it loads behind
            // the base layer.
            layer.on('load', function() {
                layer.bringToFront();
            });
        });
        return layerGroup;
    }

    function nearbyEventsOverlay() {
        eventsFeatureGroup = cartodb.L.featureGroup([]);
        $.ajax({
            url: '/api/feedevents',
            success: function (data) {
                $.each(data, function (i, event) {
                    eventsFeatureGroup.addLayer(getFeedEventMarker(event));
                });
            }
        });
        return eventsFeatureGroup;
    }

    function getBikeShareMarker(share) {
        var retina = window.devicePixelRatio > 1 ? '@2x' : '';
        var image = 'map_marker_indego' + retina + '.png';
        var shadow = 'markers-shadow' + retina + '.png';
        var icon = cartodb.L.icon({
            iconUrl: Utils.getImageUrl(image),
            shadowUrl: Utils.getImageUrl(shadow),
            iconSize: [32, 46],
            iconAnchor:   [16, 46],
            popupAnchor: [1, -32],
            shadowAnchor: [10, 14],
            shadowSize: [36, 16]
        });
        var latLng = cartodb.L.latLng(share.geometry.coordinates[1], share.geometry.coordinates[0]);
        var marker = new cartodb.L.marker(latLng, { icon: icon });
        marker.bindPopup(CAC.Map.Templates.bikeSharePopup(share), {});
        return marker;
    }

    function getFeedEventMarker(event) {
        var latLng = cartodb.L.latLng(event.point.coordinates[1], event.point.coordinates[0]);
        var icon = L.AwesomeMarkers.icon({
            icon: 'calendar',
            markerColor: 'orange',
            prefix: 'fa'
        });
        var marker = new cartodb.L.marker(latLng, { icon: icon });
        marker.bindPopup(CAC.Map.Templates.eventPopup(event), {});
        return marker;
    }

})(jQuery, cartodb, L, CAC.Utils);
