CAC.Map.OverlaysControl = (function ($, L) {
    'use strict';

    var defaults = {};

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
        return L.featureGroup([]);
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