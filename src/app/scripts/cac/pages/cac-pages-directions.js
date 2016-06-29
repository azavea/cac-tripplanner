CAC.Pages.Directions = (function ($, _, DirectionsList, Itinerary, Settings, UserPreferences, Utils) {
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
        var params = Utils.getUrlParams();
        if (!_.has(params, 'itineraryIndex')) {
            // TODO: show this error in the UI
            console.error('Must specify itineraryIndex URL parameter');
            return;
        }

        // pull out itinerary index, since it's not needed down the line
        var itineraryIndex = params.itineraryIndex;
        delete params.itineraryIndex;

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
            data: params
        }).then(function(data) {
            var itineraries = data.plan.itineraries;
            var params = data.requestParameters;
            var itinerary = new Itinerary(itineraries[itineraryIndex], itineraryIndex, params);
            setMapItinerary(itinerary);
            directionsListControl.setItinerary(itinerary);
        }, function (error) {
            console.log('error: ', error);
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

})(jQuery, _, CAC.Control.DirectionsList, CAC.Routing.Itinerary, CAC.Settings, CAC.User.Preferences, CAC.Utils);
