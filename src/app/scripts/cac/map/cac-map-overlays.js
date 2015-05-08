CAC.Map.OverlaysControl = (function ($, L) {
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
        bikeShareFeatureGroup = L.featureGroup([]);
        $.ajax({
            contentType: 'application/json',
            url: 'https://api.phila.gov/bike-share-stations/v1',
            success: function (data) {
                data = JSON.parse(data);
                $.each(data.features, function (i, share) {
                    bikeShareFeatureGroup.addLayer(getBikeShareMarker(share));
                });
            }
        });
        return bikeShareFeatureGroup;
    }

    function bikeRoutesOverlay() {
        // https://cac-tripplanner.cartodb.com/viz/501dbdc8-f4ea-11e4-8c9e-0e018d66dc29/public_map
        var url = 'https://cartocdn-ashbu.global.ssl.fastly.net/cac-tripplanner/api/v1/map/1d73301b7a6ba30ee80e8be7093ae9b2:1431024779440.44/{z}/{x}/{y}.png';
        var attribution = ['Bike routes data:',
                           '<a href="http://www.dvrpc.org/mapping/data.htm">DVRPC</a>,',
                           '<a href="https://www.opendataphilly.org/dataset/bike-network">City of Philadelphia</a>'
                           ].join(' ');
        return L.tileLayer(url, {attribution: attribution});
    }

    function nearbyEventsOverlay() {
        eventsFeatureGroup = L.featureGroup([]);
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
        var latLng = L.latLng(share.geometry.coordinates[1], share.geometry.coordinates[0]);
        var icon = L.AwesomeMarkers.icon({
            icon: 'directions-bike',
            markerColor: 'blue',
            prefix: 'md'
        });
        var marker = new L.marker(latLng, { icon: icon });
        marker.bindPopup(CAC.Map.Templates.bikeSharePopup(share), {});
        return marker;
    }

    function getFeedEventMarker(event) {
        var latLng = L.latLng(event.point.coordinates[1], event.point.coordinates[0]);
        var icon = L.AwesomeMarkers.icon({
            icon: 'calendar',
            markerColor: 'orange',
            prefix: 'fa'
        });
        var marker = new L.marker(latLng, { icon: icon });
        marker.bindPopup(CAC.Map.Templates.eventPopup(event), {});
        return marker;
    }

})(jQuery, L);
