CAC.Map.OverlaysControl = (function ($, L) {
    'use strict';

    var defaults = {};

    var bikeShareFeatureGroup = null;
    var eventsFeatureGroup = null;

    function OverlaysControl(options) {
        this.options = $.extend({}, defaults, options);
    }

    OverlaysControl.prototype.bikeShareOverlay = bikeShareOverlay;
    OverlaysControl.prototype.bikeParkingOverlay = bikeParkingOverlay;
    OverlaysControl.prototype.nearbyEventsOverlay = nearbyEventsOverlay;

    return OverlaysControl;

    // TODO: Implement - This may not be the best way to architect these depending on how these
    //                      layers are added
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

    // TODO: Implement
    function bikeParkingOverlay() {
        return L.featureGroup([]);
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
            markerColor: 'green',
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
            markerColor: 'gray',
            prefix: 'fa'
        });
        var marker = new L.marker(latLng, { icon: icon });
        marker.bindPopup(CAC.Map.Templates.eventPopup(event), {});
        return marker;
    }

})(jQuery, L);
