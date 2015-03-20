CAC.Map.Control = (function ($, L, _) {
    'use strict';

    var defaults = {
        id: 'map',
        center: [39.95, -75.1667],
        zoom: 14,
        // Note:  the three bike options must sum to 1, or OTP won't plan the trip
        bikeTriangle: {
            neutral: {
                triangleSafetyFactor: 0.34,
                triangleSlopeFactor: 0.33,
                triangleTimeFactor: 0.33
            },
            flatter: {
                triangleSafetyFactor: 0.17,
                triangleSlopeFactor: 0.66,
                triangleTimeFactor: 0.17
            },
            faster: {
                triangleSafetyFactor: 0.17,
                triangleSlopeFactor: 0.17,
                triangleTimeFactor: 0.66
            },
            safer: {
                triangleSafetyFactor: 0.66,
                triangleSlopeFactor: 0.17,
                triangleTimeFactor: 0.17
            }
        }
    };

    var map = null;
    var userMarker = null;
    var geocodeMarker = null;

    var overlaysControl = null;
    var itineraries = {};

    var events = $({});
    var basemaps = {};
    var overlays = {};
    var destinationsLayer = null;
    var isochroneLayer = null;

    var stamenTonerAttribution = [
        'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
        'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
        'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
        'under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
    ].join('');
    var stamenAttribution = [
        'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
        'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
        'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
        'under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
    ].join('');

    function MapControl(options) {
        this.events = events;
        this.options = $.extend({}, defaults, options);
        overlaysControl = new CAC.Map.OverlaysControl();
        map = L.map(this.options.id).setView(this.options.center, this.options.zoom);

        initializeBasemaps();
        initializeOverlays();
        initializeLayerControl();
    }

    MapControl.prototype.changeMode = changeMode;
    MapControl.prototype.clearDiscoverPlaces = clearDiscoverPlaces;
    MapControl.prototype.fetchIsochrone = fetchIsochrone;
    MapControl.prototype.locateUser = locateUser;
    MapControl.prototype.drawDestinations = drawDestinations;
    MapControl.prototype.plotItinerary = plotItinerary;
    MapControl.prototype.clearItineraries = clearItineraries;
    MapControl.prototype.setGeocodeMarker = setGeocodeMarker;

    return MapControl;

    function initializeBasemaps() {
        basemaps.Streets = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png', {
            attribution: stamenTonerAttribution
        });

        basemaps.Terrain = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png', {
            attribution: stamenAttribution
        });

        basemaps.Streets.addTo(map);
    }

    function initializeOverlays() {
        overlays['Bike Share Locations'] = overlaysControl.bikeShareOverlay();
        overlays['Bike Parking'] = overlaysControl.bikeParkingOverlay();
        overlays['Nearby Events'] = overlaysControl.nearbyEventsOverlay();
        overlays['Nearby Events'].addTo(map);
    }

    function initializeLayerControl() {
        L.control.layers(basemaps, overlays, {
            position: 'bottomright',
            collapsed: false
        }).addTo(map);
    }

    /**
     * Use HTML5 navigator to locate user and place a circle at their estimated location.
     *
     * @return {object} (promise) which should resolve to the current coordinates of a user
     */
    function locateUser() {
        var deferred = $.Deferred();
        var options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };
        var success = function(pos) {
            var latlng = [pos.coords.latitude, pos.coords.longitude];
            if (userMarker) {
                userMarker.setLatLng(latlng);
            } else {
                userMarker = new L.CircleMarker(latlng)
                  .on('click', function() {
                      // TODO: not implemented
                      events.trigger('CAC.Map.Control.CurrentLocationClicked', latlng);
                  });
                userMarker.setRadius(5);
                map.addLayer(userMarker);
            }
            deferred.resolve(latlng);
        };
        var failure = function(error) {
            deferred.fail(function(){return 'ERROR(' + error.code + '): ' + error.message; });
        };

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(success, failure, options);
        } else {
            deferred.fail(function() { return 'geolocation not supported on this device'; });
        }
        return deferred.promise();
    }

    /**
     * Show/hide sidebar options based on the selected mode.
     * Expects both tabs to have the same selector names for the toggleable divs.
     */
    function changeMode(selectors) {
        var mode = $(selectors.modeSelector).val();
        if (mode.indexOf('BICYCLE') > -1) {
            $(selectors.bikeTriangleDiv).removeClass('hidden');
            $(selectors.maxWalkDiv).addClass('hidden');
            $(selectors.wheelchairDiv).addClass('hidden');
        } else {
            $(selectors.bikeTriangleDiv).addClass('hidden');
            $(selectors.maxWalkDiv).removeClass('hidden');
            $(selectors.wheelchairDiv).removeClass('hidden');
        }
    }

    /**
     * Add isochrone outline to map
     */
    function drawIsochrone(isochrone) {
        isochroneLayer = L.geoJson(isochrone, {
            style: {
                'color': 'red',
                'opacity': 0.8
            }
        }).addTo(map);
    }

    /**
     * Fetch all the reachable destinations within our destination database,
     * and their enclosing isochrone (travelshed).
     *
     * @return {Object} Promise resolving to JSON with 'matched' and 'isochrone' properties
     */
    function fetchReachable(payload) {
        var isochroneUrl = '/map/reachable';
        var deferred = $.Deferred();
        $.ajax({
            type: 'GET',
            data: payload,
            cache: false,
            url: isochroneUrl,
            contentType: 'application/json'
        }).then(deferred.resolve);
        return deferred.promise();
    }

    /**
     * Get travelshed and destinations within it, then display results on map.
    */
    function fetchIsochrone(coordsOrigin, when, exploreMinutes, otpParams) {
        var deferred = $.Deferred();
        // clear results of last search
        clearDiscoverPlaces();

        var getIsochrone = function(params) {
            fetchReachable(params).then(function(data) {
                drawIsochrone(data.isochrone);
                // also draw 'matched' list of locations
                var matched = _.pluck(data.matched, 'point');
                drawDestinations(matched);
                deferred.resolve(data.matched);
            }, function(error) {
                console.error(error);
            });
        };

        var formattedTime = when.format('hh:mma');
        var formattedDate = when.format('YYYY/MM/DD');

        var params = {
            time: formattedTime,
            date: formattedDate,
            cutoffSec: exploreMinutes * 60, // API expects seconds
        };

        params = $.extend(otpParams, params);

        if (coordsOrigin) {
            params.fromPlace = coordsOrigin.join(',');
            getIsochrone(params);
        } else {
            locateUser().then(function(data) {
                params.fromPlace = data.join(',');
                getIsochrone(params);
            }, function(error) {
                console.error('Could not geolocate user');
                console.error(error);
                // use default location
                getIsochrone(params);
            });
        }

        return deferred.promise();
    }

    /**
     * Draw an array of geojson destination points onto the map
     */
    function drawDestinations(locationGeoJSON) {
        var icon = L.AwesomeMarkers.icon({
            icon: 'plane',
            prefix: 'fa',
            markerColor: 'cadetblue'
        });
        destinationsLayer = L.geoJson(locationGeoJSON, {
            onEachFeature: function(feature, layer) {
                layer.on('click', function(){
                    // TODO: not implemented
                    events.trigger('CAC.Map.Control.DestinationClicked', feature);
                });
            },
            pointToLayer: function (geojson, latLng) {
                return new L.marker(latLng, {icon: icon});
            }
        }).addTo(map);
    }

    /**
     * Plots an itinerary on a map
     *
     * @param {object} map Leaflet map object
     * @param {integer} id id of itinerary to highlight
     */
    function plotItinerary(itinerary) {
        itineraries[itinerary.id] = itinerary;
        itinerary.geojson.addTo(map);
    }


    function clearItineraries() {
        _.forIn(itineraries, function (itinerary) {
            map.removeLayer(itinerary.geojson);
        });
        itineraries = {};
    }

    /**
     * Remove layers for isochrone and destinations within it.
     */
    function clearDiscoverPlaces() {
        clearDestinations();
        clearIsochrone();
    }

    function clearDestinations() {
        if (destinationsLayer) {
            map.removeLayer(destinationsLayer);
        }
    }

    function clearIsochrone() {
        if (isochroneLayer) {
            map.removeLayer(isochroneLayer);
        }
    }

    function setGeocodeMarker(latLng) {
        if (latLng === null) {
            if (geocodeMarker) {
                map.removeLayer(geocodeMarker);
            }
            geocodeMarker = null;
            return;
        }
        if (geocodeMarker) {
            geocodeMarker.setLatLng(latLng);
        } else {
            var icon = L.AwesomeMarkers.icon({
                icon: 'dot-circle-o',
                prefix: 'fa',
                markerColor: 'darkred'
            });
            geocodeMarker = new L.marker(latLng, { icon: icon });
            geocodeMarker.addTo(map);
        }
        map.panTo(latLng);
    }

})(jQuery, L, _);
