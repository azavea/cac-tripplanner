CAC.Pages.Directions = (function ($, _, DirectionsList, Itinerary, Settings) {
    'use strict';

    var center = [39.95, -75.1667];
    var zoom = 12;

    // TODO: Remove duplicate from cac-map-control.js
    var cartodbAttribution = [
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ',
        '&copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    ].join('');

    var defaults = {
        selectors: {
            directionsContainer: '.directions-list'
        }
    };

    var map = null;

    function Directions(options) {
        this.options = $.extend({}, defaults, options);
    }

    Directions.prototype.initialize = function () {

        // Note: date/time does not get passed and so always defaults to departing now

        var rawParams = location.search.slice(1).split('&');
        var itineraryIndex = -1; // initialize to flag value for missing index parameter

        // process parameters for consumption by OpenTripPlanner:
        // strip out itineraryIndex, and convert singe waypoint parameter into
        // multiple intermediatePlaces parameters.
        var otpParams = _.map(rawParams, function(paramStr) {
            if (paramStr.indexOf('waypoints') === 0) {
                // parse into intermediatePlaces param string
                var vals = paramStr.slice(paramStr.indexOf('=') + 1);
                var waypointStrings = decodeURIComponent(vals).split(';');
                return _.map(waypointStrings, function(waypointString) {
                    return 'intermediatePlaces=' + waypointString;
                }).join('&');

            } else if (paramStr.indexOf('itineraryIndex') === 0) {
                itineraryIndex = decodeURIComponent(paramStr.slice(paramStr.indexOf('=') + 1));
                itineraryIndex = parseInt(itineraryIndex);
                if (isNaN(itineraryIndex)) {
                    console.error('itineraryIndex URL parameter must be an integer');
                    return;
                }
            } else if (paramStr.indexOf('origin') === 0) {
                var originValue = paramStr.slice(paramStr.indexOf('='));
                if (paramStr.indexOf('originText') !== 0) {
                    return 'fromPlace' + originValue;
                } else {
                    return 'fromText' + originValue;
                }
            } else if (paramStr.indexOf('destination') === 0) {
                var destValue = paramStr.slice(paramStr.indexOf('='));
                if (paramStr.indexOf('destinationText') !== 0) {
                    return 'toPlace' + destValue;
                } else {
                    return 'toText' + destValue;
                }
            } else {
                return paramStr;
            }
        }).join('&');

        if (itineraryIndex < 0) {
            console.error('Must specify itineraryIndex URL parameter');
            return;
        }

        var directionsListControl = new DirectionsList({
            showBackButton: false,
            showShareButton: false,
            selectors: {
                container: this.options.selectors.directionsContainer
            }
        });

        loadMap();

        $.ajax({
            url: Settings.routingUrl,
            type: 'GET',
            crossDomain: true,
            data: otpParams,
            processData: false
        }).then(function(data) {
            var itineraries = data.plan.itineraries;
            var itinerary = new Itinerary(itineraries[itineraryIndex],
                                          itineraryIndex);
            setMapItinerary(itinerary);
            directionsListControl.setItinerary(itinerary);
        }, function (error) {
            console.error(error);
        });

        function loadMap() {
            var mapOptions = {
                zoomControl: false
            };
            var retina = '';
            if (window.devicePixelRatio > 1) {
                retina = '@2x';
            }
            map = cartodb.L.map('directions-map', mapOptions).setView(center, zoom);
            // TODO: Remove duplicate from cac-map-control.js
            var basemap = cartodb.L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}' + retina + '.png', {
                attribution: cartodbAttribution
            });
            basemap.addTo(map);
        }

        function setMapItinerary(itinerary) {
            map.fitBounds(itinerary.geojson.getBounds(), {
                padding: [30,30]
            });
            itinerary.geojson.addTo(map);

            var originIcon = L.AwesomeMarkers.icon({
                icon: 'home',
                prefix: 'fa',
                markerColor: 'purple'
            });

            var destIcon = L.AwesomeMarkers.icon({
                icon: 'flag-o',
                prefix: 'fa',
                markerColor: 'red'
            });

            var origin = [itinerary.from.lat, itinerary.from.lon];
            var destination = [itinerary.to.lat, itinerary.to.lon];
            var originOptions = {icon: originIcon, title: 'origin' };
            var originMarker = new cartodb.L.marker(origin, originOptions);

            var destOptions = {icon: destIcon, title: 'destination' };
            var destinationMarker = new cartodb.L.marker(destination, destOptions);

            originMarker.addTo(map);
            destinationMarker.addTo(map);
        }
    };

    return Directions;

})(jQuery, _, CAC.Control.DirectionsList, CAC.Routing.Itinerary, CAC.Settings);
