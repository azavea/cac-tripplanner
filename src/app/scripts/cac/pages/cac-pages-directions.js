CAC.Pages.Directions = (function ($, _, DirectionsList, Itinerary, Settings, Utils) {
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

        Utils.initializeMoment();

        // Note: date/time does not get passed and so always defaults to departing now

        var rawParams = _.map(location.search.slice(1).split('&'), function(p) {
            return p.split('=');
        });

        // Pull out the itinerary index and validate it
        var itineraryIndex = _.remove(rawParams, function(p) {
            return p[0] === 'itineraryIndex';
        });

        if (!itineraryIndex || itineraryIndex.length < 1) {
            console.error('Must specify itineraryIndex URL parameter');
            return;
        } else {
            itineraryIndex = parseInt(itineraryIndex[0][1]);
            if (isNaN(itineraryIndex)) {
                console.error('itineraryIndex URL parameter must be an integer');
                return;
            }
        }

        // Rules for rewriting GoPhillyGo URL params to OTP query params.
        // If 'values' is defined, parse out the value into multiple copies of the param,
        // one per item in the array returned by calling 'values' with the URL parameter value.
        // Any URL param not in the mapping is passed through unchanged.
        var mapping = {
            origin: { paramName: 'fromPlace' },
            originText: { paramName: 'fromText' },
            destination: { paramName: 'toPlace' },
            destinationText: { paramName: 'toText' },
            tourMode: { paramName: 'tourMode' },
            waypoints: {
                paramName: 'intermediatePlaces',
                values: function (val) {
                    return _.map(decodeURIComponent(val).split(';'), encodeURIComponent);
                }
            },
        };

        // Rewrites an array of [URLparam, value] pairs into an array of [OTPparam, value] pairs,
        // using the mapping above.
        var otpParams = _(rawParams).map(function (param) {
            if (!mapping[param[0]]) {
                return [param];
            } else {
                var config = mapping[param[0]];
                if (!config.values) {
                    return [[config.paramName, param[1]]];
                } else {
                    return _.map(config.values(param[1]), function (val) {
                        return [config.paramName, val];
                    });
                }
            }
        }).flatten().value();


        var tourMode = false;
        if (otpParams.hasOwnProperty('tourMode')) {
            tourMode = otpParams.tourMode;
            delete otpParams.tourMode;
        }
        // Join array into param string
        otpParams = _(otpParams).map(function (item) { return item.join('='); }).join('&');

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
        }).done(function(data) {
            var itineraries = data.plan.itineraries;
            var itinerary = new Itinerary(itineraries[itineraryIndex],
                                          itineraryIndex,
                                          tourMode);
            setMapItinerary(itinerary);
            directionsListControl.setItinerary(itinerary);
        }).fail(function (error) {
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

})(jQuery, _, CAC.Control.DirectionsList, CAC.Routing.Itinerary, CAC.Settings, CAC.Utils);
