CAC.Map.Control = (function ($, L, _) {
    'use strict';

    var defaults = {
        id: 'map',
        center: [39.95, -75.1667],
        zoom: 14
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

    MapControl.prototype.clearDiscoverPlaces = clearDiscoverPlaces;
    MapControl.prototype.fetchIsochrone = fetchIsochrone;
    MapControl.prototype.locateUser = locateUser;
    MapControl.prototype.drawDestinations = drawDestinations;
    MapControl.prototype.getItineraryById = getItineraryById;
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
            position: 'bottomright'
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
        if (payload.coords && payload.mode && payload.date &&
            payload.time && payload.maxTravelTime && payload.maxWalkDistance) {
            $.ajax({
                type: 'GET',
                data: payload,
                url: isochroneUrl,
                contentType: 'application/json'
            }).then(deferred.resolve);
        } else {
            deferred.fail();
        }
        return deferred.promise();
    }

    /**
     * Get travelshed and destinations within it, then display results on map.
    */
    function fetchIsochrone() {
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

        // default to current date and time
        var now = new Date();
        // months are zero-based
        var dateStr = [(now.getMonth() + 1),
                        now.getDate(),
                        now.getFullYear()
                      ].join('-');

        // TODO: implement saving user preferences to fetch for params
        var params = {
            coords: {
                lat: 39.954688,
                lng: -75.204677
            },
            mode: ['WALK', 'TRANSIT'],
            date: dateStr,
            time: now.toTimeString(),
            maxTravelTime: 1800,
            maxWalkDistance: 1609
        };

        locateUser().then(function(data) {
            params.coords.lat = data[0];
            params.coords.lng = data[1];
            getIsochrone(params);
        }, function(error) {
            console.log('Could not geolocate user');
            console.error(error);
            // use default location
            getIsochrone(params);
        });
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

    function getItineraryById(id) {
        return itineraries[id];
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
