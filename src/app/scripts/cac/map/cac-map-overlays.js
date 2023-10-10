CAC.Map.OverlaysControl = (function ($, cartodb, L, Utils) {
    'use strict';

    var defaults = {
        selectors: {
            bikeSharePopupClassName: 'bikeshare-popup',
            eventPopupClassName: 'event-popup'
        }
    };

    var options = null;
    var bikeShareFeatureGroup = null;
    var eventsFeatureGroup = null;

    function OverlaysControl(opts) {
        options = $.extend({}, defaults, opts);
    }

    OverlaysControl.prototype.bikeShareOverlay = bikeShareOverlay;
    OverlaysControl.prototype.bikeRoutesOverlay = bikeRoutesOverlay;
    OverlaysControl.prototype.nearbyEventsOverlay = nearbyEventsOverlay;

    return OverlaysControl;

    function bikeShareOverlay() {
        bikeShareFeatureGroup = cartodb.L.featureGroup([]);
        $.ajax({
            cache: false,
            dataType: 'json',
            url: 'https://bts-status.bicycletransit.workers.dev/phl',
            success: function (data) {
                $.each(data.features, function (i, share) {
                    bikeShareFeatureGroup.addLayer(getBikeShareMarker(share));
                });
            }
        });
        return bikeShareFeatureGroup;
    }

    function bikeRoutesOverlay(map) {
        var layerGroup = cartodb.L.featureGroup([]);
        var url = 'https://cac-tripplanner.carto.com/api/v2/viz/aca1808b-b8f0-465d-b8b4-e2fdbca78568/viz.json';
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
        marker.bindPopup(CAC.Map.Templates.bikeSharePopup(share),
                         {className: options.selectors.bikeSharePopupClassName});
        return marker;
    }

    function getFeedEventMarker(event) {
        var latLng = cartodb.L.latLng(event.point.coordinates[1], event.point.coordinates[0]);
        var icon = L.AwesomeMarkers.icon(Utils.feedEventIconConfig);
        var marker = new cartodb.L.marker(latLng, { icon: icon });
        marker.bindPopup(CAC.Map.Templates.eventPopup(event),
                         {className: options.selectors.eventPopupClassName});
        return marker;
    }

})(jQuery, cartodb, L, CAC.Utils);
