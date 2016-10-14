CAC.Map.Control = (function ($, Handlebars, cartodb, L, turf, _) {
    'use strict';

    var defaults = {
        id: 'map',
        center: [39.95, -75.1667],
        zoom: 14,
        selectors: {
            destinationPopup: '.destination-directions-link'
        }
    };

    var map = null;
    var userMarker = null;
    var geocodeMarker = null;
    var directionsMarkers = {
        origin: null,
        destination: null
    };

    var overlaysControl = null;
    var itineraries = {};

    var events = $({});
    var eventNames = {
        destinationPopupClick: 'cac:map:control:destinationpopup',
        currentLocationClick: 'cac:map:control:currentlocation',
        originMoved: 'cac:map:control:originmoved',
        destinationMoved: 'cac:map:control:destinationmoved',
        geocodeMarkerMoved: 'cac:map:control:geocodemoved',
        waypointMoved: 'cac:map:control:waypointmoved',
        waypointsSet: 'cac:map:control:waypointsset'
    };
    var basemaps = {};
    var overlays = {};
    var destinationsLayer = null;
    var destinationMarkers = {};
    var lastHighlightedMarker = null;
    var lastDisplayPointMarker = null;
    var lastItineraryHoverMarker = null;
    var itineraryHoverListener = null;
    var isochroneLayer = null;
    var waypointsLayer = null;
    var tabControl = null;

    var destinationIcon = L.AwesomeMarkers.icon({
        icon: 'beenhere',
        prefix: 'md',
        markerColor: 'green'
    });
    var highlightIcon = L.AwesomeMarkers.icon({
        icon: 'beenhere',
        prefix: 'md',
        iconColor: 'black',
        markerColor: 'lightgreen'
    });

    var esriSatelliteAttribution = [
        '&copy; <a href="http://www.esri.com/">Esri</a> ',
        'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, ',
        'AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
    ].join('');
    var cartodbAttribution = [
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ',
        '&copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    ].join('');

    /**
     * Variables used for limiting to one isochrone request at a time.
     * Unlike the planTrip request, the isochrone request cannot be handled
     * solely via debounce, due to differences in the way the isochrone
     * request flows through the system. There are actions that take place
     * on this module (drawing the isochrone on the map), and then actions
     * that take place on the sidebar module (generating the destinations),
     * so doing the limiting correctly is more of a challenge.
     */
    var activeIsochroneRequest = null;
    var pendingIsochroneRequest = null;

    function MapControl(options) {
        this.events = events;
        this.eventNames = eventNames;
        this.options = $.extend({}, defaults, options);
        overlaysControl = new CAC.Map.OverlaysControl();
        map = new cartodb.L.map(this.options.id, { zoomControl: false })
            .setView(this.options.center, this.options.zoom);

        // put zoom control on top right
        new cartodb.L.Control.Zoom({ position: 'topright' }).addTo(map);

        tabControl = options.tabControl;

        initializeBasemaps();
        initializeOverlays();
        initializeLayerControl();

        // set listener for click event on destination popup
        $('#' + this.options.id).on('click', this.options.selectors.destinationPopup, function(event) {
            events.trigger(eventNames.destinationPopupClick,
                           destinationMarkers[event.currentTarget.id].destination);
        });

        // add minimize button to layer control
        var leafletMinimizer = '.leaflet-minimize';
        var leafletLayerList = '.leaflet-control-layers-list';
        var $layerContainer = $('.leaflet-control-layers');

        $layerContainer.prepend('<div class="leaflet-minimize"><i class="fa fa-minus"></i></div>');
        $(leafletMinimizer).click(function() {
            if ($(leafletMinimizer).hasClass('minimized')) {
                // show again
                $(leafletLayerList).show();
                $(leafletMinimizer).html('<i class="fa fa-minus"></i>');
                $(leafletMinimizer).removeClass('minimized');
            } else {
                // minimize it
                $(leafletMinimizer).html('<i class="fa fa-map-marker"></i>');
                $(leafletMinimizer).addClass('minimized');
                $(leafletLayerList).hide();
            }
        });
    }

    MapControl.prototype.clearIsochrone = clearIsochrone;
    MapControl.prototype.clearDiscoverPlaces = clearDiscoverPlaces;
    MapControl.prototype.fetchIsochrone = fetchIsochrone;
    MapControl.prototype.locateUser = locateUser;
    MapControl.prototype.drawDestinations = drawDestinations;
    MapControl.prototype.plotItinerary = plotItinerary;
    MapControl.prototype.clearItineraries = clearItineraries;
    MapControl.prototype.clearWaypointInteractivity = clearWaypointInteractivity;
    MapControl.prototype.draggableItinerary = draggableItinerary;
    MapControl.prototype.setGeocodeMarker = setGeocodeMarker;
    MapControl.prototype.setDirectionsMarkers = setDirectionsMarkers;
    MapControl.prototype.clearDirectionsMarker = clearDirectionsMarker;
    MapControl.prototype.highlightDestination = highlightDestination;
    MapControl.prototype.displayPoint = displayPoint;

    return MapControl;

    function initializeBasemaps() {
        var retina = '';
        if (window.devicePixelRatio > 1) {
            retina = '@2x';
        }

        basemaps.Light = cartodb.L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}' + retina + '.png', {
            attribution: cartodbAttribution
        });

        basemaps.Dark = cartodb.L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}' + retina + '.png', {
            attribution: cartodbAttribution
        });

        basemaps.Satellite = cartodb.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: esriSatelliteAttribution
        });

        basemaps.Light.addTo(map);

        // In case the base layer changes after the bike routes overlay has been added,
        // make sure the bike routes overlay shows on top of the new base layer.
        map.on('baselayerchange', function() {
            if (map.hasLayer(overlays['Bike Routes'])) {
                overlays['Bike Routes'].bringToFront();
            }
        });
    }

    function initializeOverlays() {
        overlays['Bike Share Locations'] = overlaysControl.bikeShareOverlay();
        overlays['Bike Routes'] = overlaysControl.bikeRoutesOverlay(map);

        // TODO: re-enable when Uwishunu feed returns
        //overlays['Nearby Events'] = overlaysControl.nearbyEventsOverlay();
        //overlays['Nearby Events'].addTo(map);
    }

    function initializeLayerControl() {
        cartodb.L.control.layers(basemaps, overlays, {
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
                userMarker = new cartodb.L.CircleMarker(latlng)
                  .on('click', function() {
                      // TODO: not implemented
                      events.trigger(eventNames.currentLocationClick, latlng);
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
    function drawIsochrone(isochrone, zoomToFit) {
        try {
            isochroneLayer = cartodb.L.geoJson(isochrone, {
                clickable: false,
                style: {
                    clickable: false,
                    color: '#5c2482',
                    fillColor: '#5c2482',
                    lineCap: 'round',
                    lineJoin: 'round',
                    opacity: 0.4,
                    fillOpacity: 0.3,
                    stroke: true,
                    weight: 2
                }
            });
        } catch (err) {
            console.error('isochrone layer failed to load from GeoJSON');
            console.error(err);
            isochroneLayer = null;
        }

        if (isochroneLayer) {
            isochroneLayer.addTo(map);
            if (zoomToFit) {
                map.fitBounds(isochroneLayer.getBounds());
            }
        }
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
     * Makes an isochrone request. Only allows one isochrone request at a time.
     * If another request comes in while one is active, the results of the active
     * request will be discarded upon completion, and the new query issued.
     *
     * @param {Deferred} A jQuery Deferred object used for resolution
     * @param {Object} Parameters to be sent along with the request
     * @param {boolean} Whether to pan/zoom map to fit returned isochrone
     */
    function getIsochrone(deferred, params, zoomToFit) {
        // Check if there's already an active request. If there is one,
        // then we can't make a query yet -- store it as pending.
        // If there was already a pending query, immediately resolve it.
        if (activeIsochroneRequest) {
            if (pendingIsochroneRequest) {
                pendingIsochroneRequest.deferred.resolve();
            }
            pendingIsochroneRequest = { deferred: deferred, params: params, zoomToFit: zoomToFit };
            return;
        }

        // Set the active isochrone request and make query
        activeIsochroneRequest = { deferred: deferred, params: params, zoomToFit: zoomToFit };
        fetchReachable(params).then(function(data) {
            activeIsochroneRequest = null;
            if (pendingIsochroneRequest) {
                // These results are already out of date. Don't display them, and instead
                // send off the pending request.
                deferred.resolve();

                var pending = pendingIsochroneRequest;
                pendingIsochroneRequest = null;
                getIsochrone(pending.deferred, pending.params, zoomToFit);
                return;
            }

            if (!tabControl.isTabShowing('explore')) {
                // if user has switched away from the explore tab, do not show results
                deferred.resolve();
                return;
            }
            drawIsochrone(data.isochrone, zoomToFit);
            // also draw 'matched' list of locations
            drawDestinations(data.matched);
            deferred.resolve(data.matched);
        }, function(error) {
            activeIsochroneRequest = null;
            pendingIsochroneRequest = null;
            console.error(error);
        });
    }

    /**
     * Get travelshed and destinations within it, then display results on map.
    */
    function fetchIsochrone(coordsOrigin, when, exploreMinutes, otpParams, zoomToFit) {
        var deferred = $.Deferred();
        // clear results of last search
        clearDiscoverPlaces();

        var formattedTime = when.format('hh:mma');
        var formattedDate = when.format('YYYY/MM/DD');

        var params = {
            time: formattedTime,
            date: formattedDate,
            cutoffSec: exploreMinutes * 60 // API expects seconds
        };

        // Default precision of 200m; 100m seems good for improving response times on non-transit
        // http://dev.opentripplanner.org/apidoc/0.12.0/resource_LIsochrone.html
        if (otpParams.mode === 'WALK' || otpParams.mode === 'BICYCLE') {
            params.precisionMeters = 100;
        }

        params = $.extend(otpParams, params);

        if (coordsOrigin) {
            params.fromPlace = coordsOrigin.join(',');
            getIsochrone(deferred, params, zoomToFit);
        }

        return deferred.promise();
    }

    /**
     * Draw an array of geojson destination points onto the map
     */
    function drawDestinations(matched) {
        // put destination details onto point geojson object's properties
        // build map of unconverted destination objects
        var destinations = {};
        var locationGeoJSON = _.map(matched, function(destination) {
            destinations[destination.id] = destination;
            var point = _.property('point')(destination);
            point.properties = _.omit(destination, 'point');
            return point;
        });
        destinationMarkers = {};
        destinationsLayer = cartodb.L.geoJson(locationGeoJSON, {
            pointToLayer: function (geojson, latLng) {
                var popupTemplate = ['<h4>{{geojson.properties.name}}</h4>',
                                     '<div class="destination-description">',
                                    // HTML-formatted description
                                     geojson.properties.description,
                                     '</div>',
                                     '<a href="{{geojson.properties.website_url}}" ',
                                     'target="_blank">{{geojson.properties.website_url}}</a>',
                                     '<a class="destination-directions-link pull-right" ',
                                     'id="{{geojson.properties.id}}">Get Directions</a>'
                                    ].join('');
                var template = Handlebars.compile(popupTemplate);
                var popupContent = template({geojson: geojson});
                var markerId = geojson.properties.id;
                var marker = new cartodb.L.marker(latLng, {icon: destinationIcon})
                        .bindPopup(popupContent);
                destinationMarkers[markerId] = {
                    marker: marker,
                    destination: destinations[geojson.properties.id]
                };
                return marker;
            }
        }).addTo(map);
    }

    /**
     * Plots an itinerary on a map, optionally zooming to fit.
     *
     * @param {Object} itinerary CAC.Routing.Itinerary object with geojson to draw
     * @param {Boolean} makeFit If true, zoom to fit itinerary in view
     */
    function plotItinerary(itinerary, makeFit) {
        itineraries[itinerary.id] = itinerary;
        var layer = itinerary.geojson.addTo(map);
        if (makeFit) {
            map.fitBounds(layer.getBounds());
        }
    }

    /**
     * Add listeners to an itinerary map layer to make it draggable.
     *
     * @param {Object} itinerary CAC.Routing.Itinerary object to be made draggable
     */
    function draggableItinerary(itinerary) {
        clearWaypointInteractivity();
        // Show a draggable marker on the route line that adds a waypoint when released.

        var lastLayer = itinerary.geojson;
        var redrawWaypointDrag = _.throttle(function(event, index) { // jshint ignore:line

                // TODO: delay layer removal via held layer reference until response comes back

                // TODO: why does this not work
                map.removeLayer(lastLayer);

                console.log(event.target.getLatLng());
                var coords = event.target.getLatLng();
                var waypoints = updateWaypointList(itinerary, index, [coords.lat, coords.lng]);
                itinerary.routingParams.extraOptions.waypoints = waypoints;

                events.trigger(eventNames.waypointMoved, itinerary);
        }, 800, {leading: true, trailing: true});

        // Leaflet listeners are removed by reference, so retain a reference to the
        // listener function to be able to turn it off later.
        itineraryHoverListener = function(e) {
            if (lastItineraryHoverMarker) {
                lastItineraryHoverMarker.setLatLng(e.latlng, {draggable: true});
            } else {
                // flag if user currently dragging out a new waypoint or not
                var dragging = false;
                // track where user clicked on drag start, to find nearby line points
                var startDragPoint = null;
                // Use a timeout when closing the popup so it doesn't strobe on extraneous mouseouts
                var popupTimeout;
                lastItineraryHoverMarker = new cartodb.L.Marker(e.latlng, {
                        draggable: true,
                        icon: highlightIcon
                    }).on('dragstart', function(e) {
                        dragging = true;
                        startDragPoint = e.target.getLatLng();
                    }).on('dragend', function(e) {
                        dragging = false;
                        var coords = e.target.getLatLng();
                        addWaypoint(itinerary, [coords.lat, coords.lng],
                                    [startDragPoint.lng, startDragPoint.lat]);
                        startDragPoint = null;
                    });

                lastItineraryHoverMarker.bindPopup('Drag marker to change route',
                                                   {closeButton: false})
                    .on('mouseover', function() {
                        clearTimeout(popupTimeout);
                        return dragging || this.openPopup();
                    }).on('mouseout', function() {
                        // Close popup, but with a slight delay to avoid flickering, and with an
                        // existence check to avoid errors if the marker has been destroyed
                        popupTimeout = setTimeout(function() {
                            if (lastItineraryHoverMarker) {
                                lastItineraryHoverMarker.closePopup();
                            }
                         }, 50);

                        // hide marker after awhile if not dragging
                        if (dragging) {
                            return;
                        }

                        setTimeout(function() {
                            if (lastItineraryHoverMarker && !dragging) {
                                map.removeLayer(lastItineraryHoverMarker);
                                lastItineraryHoverMarker = null;
                                dragging = false;
                                startDragPoint = null;
                            }
                        }, 3000);
                    }); //}).on('drag', redrawWaypointDrag);
                map.addLayer(lastItineraryHoverMarker);
            }
        };

        itinerary.geojson.on('mouseover', itineraryHoverListener);

        // add a layer of draggable markers for the existing waypoints
        if (itinerary.waypoints) {
            var dragging = false;
            var popupTimeout;
            waypointsLayer = cartodb.L.geoJson(turf.featureCollection(itinerary.waypoints), {
                pointToLayer: function(geojson, latlng) {
                    var marker = new cartodb.L.marker(latlng, {icon: destinationIcon,
                                                               draggable: true });
                    marker.on('dragstart', function() {
                        dragging = true;
                    }).on('dragend', function(e) {
                        dragging = false;
                        var coords = e.target.getLatLng();
                        moveWaypoint(itinerary, geojson.properties.index, [coords.lat, coords.lng]);
                    }).on('click', function() {
                        removeWaypoint(itinerary, geojson.properties.index);
                    }).on('drag', function(event) {
                            lastLayer = itinerary.geojson;
                            redrawWaypointDrag(event, geojson.properties.index);
                    });

		    marker.bindPopup('Drag to change or click to remove', {closeButton: false})
                    .on('mouseover', function () {
                        clearTimeout(popupTimeout);
                        return dragging || this.openPopup();
                    }).on('mouseout', function () {
                        // Close popup, but with a slight delay to avoid flickering, and with an
                        // existence check to avoid errors if the marker has been destroyed
                        popupTimeout = setTimeout(function() {
                            if (marker) {
                                marker.closePopup();
                            }
                        }, 50);
                    });
                    return marker;
                }
            }).addTo(map);
        }
    }

    /**
     * Add a waypoint. If there is one or more existing waypoints, add the waypoint between
     * the two nearest points to where the user began the route edit on the linestring,
     * adding the new point to the sequence of waypoints + origin and destination points,
     * ordered from origin to destination.
     *
     * @param {Object} itinerary CAC.Routing.Itinerary object with waypoint to move
     * @param {array} newWaypoint coordinates as [lat, lng] for waypoint to add
     * @param {array} startDragPoint geoJSON coordinates (lng, lat) of place on itinerary
     *                line where user began dragging to change route
     */
    function addWaypoint(itinerary, newWaypoint, startDragPoint) {

        var waypoints = itinerary.waypoints;
        if (!waypoints || !waypoints.length) {
            // first waypoint added; no need to interpolate with existing waypoints
            events.trigger(eventNames.waypointsSet, {waypoints: [newWaypoint]});
            return;
        }

        var originPoint = turf.point([itinerary.from.lon, itinerary.from.lat], {index: -1});
        var destPoint = turf.point([itinerary.to.lon, itinerary.to.lat], {index: waypoints.length});

        var allFeatures = _.concat([originPoint], waypoints, [destPoint]);

        var turfPoint = turf.point(startDragPoint);
        var nearest = turf.nearest(turfPoint, turf.featureCollection(allFeatures));

        var nearestIndex = nearest.properties.index;

        // drop the nearest point to repeat search, in order to find next nearest
        var remainingFeatures = _.concat(_.slice(allFeatures, 0, nearestIndex),
                                       _.slice(allFeatures, nearestIndex + 1));

        var nextNearest = turf.nearest(turfPoint, turf.featureCollection(remainingFeatures));

        var nextNearestIndex = nextNearest.properties.index;

        // determine the sequence ordering of the two nearest points, so the new point can
        // be added between them
        var smallerIndex = Math.min(nearestIndex, nextNearestIndex);
        var largerIndex = Math.max(nearestIndex, nextNearestIndex);
        var newIndex = smallerIndex + 1;

        // If the nearest two points aren't in sequence and the larger indexed one is closer,
        // put the new point right before that one instead of right after the 2nd nearest
        if (largerIndex - smallerIndex !== 1 && smallerIndex !== nearestIndex) {
            newIndex = largerIndex - 1;
        }

        // extract the coordinates for the existing waypoints
        var coordinates = _.map(waypoints, function(waypoint) {
            return waypoint.geometry.coordinates.reverse();
        });

        // insert new waypoint into ordered points list
        coordinates = _.concat(_.slice(coordinates, 0, newIndex),
                               [newWaypoint],
                               _.slice(coordinates, newIndex));

        // requery with the changed points as waypoints
        events.trigger(eventNames.waypointsSet, {waypoints: coordinates});
    }

    /**
     * Helper to get updated list of waypoints on waypoint drag or drag end.
     *
     * @param {Object} itinerary CAC.Routing.Itinerary object with waypoint to move
     * @param {integer} waypointIndex offset of waypoint to move
     * @param {array} newCoordinates [lat, lng] of new location for the waypoint
     */
    function updateWaypointList(itinerary, waypointIndex, newCoordinates) {
        // should not happen, but sanity-check for waypoint indexing
        if (!itinerary.waypoints || itinerary.waypoints.length <= waypointIndex) {
            console.error('Could not find waypoint to move');
            return;
        }

        // extract the coordinates for the existing waypoints,
        // exchanging for new coordinates on moved waypoint
        return _.map(itinerary.waypoints, function(waypoint, index) {
            if (index === waypointIndex) {
                return newCoordinates;
            } else {
                return waypoint.geometry.coordinates.reverse();
            }
        });
    }

    /**
     * Move an existing waypoint on an itinerary.
     *
     * @param {Object} itinerary CAC.Routing.Itinerary object with waypoint to move
     * @param {integer} waypointIndex offset of waypoint to move
     * @param {array} newCoordinates [lat, lng] of new location for the waypoint
     */
    function moveWaypoint(itinerary, waypointIndex, newCoordinates) {
        var coordinates = updateWaypointList(itinerary, waypointIndex, newCoordinates);
        // requery with the changed points as waypoints
        events.trigger(eventNames.waypointsSet, {waypoints: coordinates});
    }

    /**
     * Remove a waypoint from an itinerary.
     *
     * @param {Object} itinerary CAC.Routing.Itinerary object with waypoint to remove
     * @param {integer} waypointIndex offset of waypoint to remove from itinerary
     */
    function removeWaypoint(itinerary, waypointIndex) {
        // should not happen, but sanity-check for waypoint indexing
        if (!itinerary.waypoints || itinerary.waypoints.length <= waypointIndex) {
            console.error('Could not find waypoint to remove');
            return;
        }

        // remove waypoint from ordered points list
        itinerary.waypoints.splice(waypointIndex, 1);

        // extract the coordinates for the existing waypoints
        var coordinates = _.map(itinerary.waypoints, function(waypoint) {
            return waypoint.geometry.coordinates.reverse();
        });

        // requery with the changed points as waypoints
        events.trigger(eventNames.waypointsSet, {waypoints: coordinates});
    }

    function clearItineraries() {
        clearWaypointInteractivity();
        _.forIn(itineraries, function (itinerary) {
            map.removeLayer(itinerary.geojson);
        });
        itineraries = {};
    }

    function clearWaypointInteractivity() {
        if (waypointsLayer) {
            map.removeLayer(waypointsLayer);
            waypointsLayer = null;
        }

        if (lastItineraryHoverMarker) {
            map.removeLayer(lastItineraryHoverMarker);
            lastItineraryHoverMarker = null;
        }

        _.forIn(itineraries, function (itinerary) {
            itinerary.geojson.off('mouseover', itineraryHoverListener);
        });
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
        // helper for when marker dragged to new place
        function markerDrag(event) {
            var marker = event.target;
            var position = marker.getLatLng();
            var latlng = new cartodb.L.LatLng(position.lat, position.lng);
            marker.setLatLng(latlng, {draggable: true});
            map.panTo(latlng); // allow user to drag marker off map

            events.trigger(eventNames.geocodeMarkerMoved, position);
        }

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
            geocodeMarker = new cartodb.L.marker(latLng, { icon: icon, draggable: true });
            geocodeMarker.addTo(map);
            geocodeMarker.on('dragend', markerDrag);
        }
        map.panTo(latLng);
    }

    /**
     * Show markers for trip origin/destination.
     * Will unset the corresponding marker if either coordinate set is null/empty.
     *
     * @param {Array} originCoords Start point coordinates [lat, lng]
     * @param {Array} destinationCoords End point coordinates [lat, lng]
     * @param {Boolean} [zoomToFit] Zoom the view to the marker(s)
     */
    function setDirectionsMarkers(originCoords, destinationCoords, zoomToFit) {

        // helper for when origin/destination dragged to new place
        function markerDrag(event) {
            var marker = event.target;
            var position = marker.getLatLng();
            var latlng = new cartodb.L.LatLng(position.lat, position.lng);
            marker.setLatLng(latlng, {draggable: true});

            var trigger = (marker.options.title === 'origin') ?
                            eventNames.originMoved : eventNames.destinationMoved;

            events.trigger(trigger, position);
        }

        // Due to time constraints, these two icon definitions were copied to cac-pages-directions.js
        // for use on the static map page there. If you change them here, change them there as well
        // Remove comment if icon definitions are abstracted elsewhere
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

        if (originCoords) {
            var origin = cartodb.L.latLng(originCoords[0], originCoords[1]);

            if (directionsMarkers.origin) {
                directionsMarkers.origin.setLatLng(origin);
            } else {
                var originOptions = {icon: originIcon, draggable: true, title: 'origin' };
                directionsMarkers.origin = new cartodb.L.marker(origin, originOptions)
                                                        .bindPopup('<p>Origin</p>');
                directionsMarkers.origin.addTo(map);
                directionsMarkers.origin.on('dragend', markerDrag);
            }
        } else {
            clearDirectionsMarker('origin');
        }

        if (destinationCoords) {
            var destination = cartodb.L.latLng(destinationCoords[0], destinationCoords[1]);

            if (directionsMarkers.destination) {
                directionsMarkers.destination.setLatLng(destination);
            } else {
                var destOptions = {icon: destIcon, draggable: true, title: 'destination' };
                directionsMarkers.destination = new cartodb.L.marker(destination, destOptions)
                                                             .bindPopup('<p>Destination</p>');
                directionsMarkers.destination.addTo(map);
                directionsMarkers.destination.on('dragend', markerDrag);
            }
        } else {
            clearDirectionsMarker('destination');
        }

        var markers = _.compact(_.values(directionsMarkers));
        if (zoomToFit && !_.isEmpty(markers)) {
            // zoom to fit all markers if several, or if there's only one, center on it
            if (markers.length > 1) {
                map.fitBounds(L.latLngBounds(markers), { maxZoom: defaults.zoom });
            } else {
                map.setView(markers[0].getLatLng());
            }
        }
    }

    function clearDirectionsMarker(type) {
        if (directionsMarkers[type]) {
            map.removeLayer(directionsMarkers[type]);
        }
        directionsMarkers[type] = null;
    }

    function highlightDestination(destinationId, opts) {
        var defaults = {
            panTo: false
        };
        var options = $.extend({}, defaults, opts);
        if (!destinationId) {
            // revert to original marker if set
            if (lastHighlightedMarker) {
                lastHighlightedMarker.setIcon(destinationIcon);
            }
            return;
        }
        // Update icon for passed destination
        var marker = destinationMarkers[destinationId].marker;
        marker.setIcon(highlightIcon);
        if (options.panTo) {
            map.panTo(marker.getLatLng());
        }
        lastHighlightedMarker = marker;
    }

    /**
     * Displays a simple point marker on the map.
     * Currently only used while a leg of a direction is hovered over.
     *
     * Only one point can be displayed at a time.
     * If this is called without lon/lat params, the current point is removed.
     *
     * @param {Int} Longitude
     * @param {Int} Latitude
     */
    function displayPoint(lon, lat) {
        if (lon && lat) {
            var latlng = new cartodb.L.LatLng(lat, lon);
            if (!lastDisplayPointMarker) {
                lastDisplayPointMarker = new cartodb.L.CircleMarker(latlng);
                lastDisplayPointMarker.addTo(map);
            } else {
                lastDisplayPointMarker.setLatLng(latlng);
            }
        } else if (lastDisplayPointMarker) {
            map.removeLayer(lastDisplayPointMarker);
            lastDisplayPointMarker = null;
        }
    }

})(jQuery, Handlebars, cartodb, L, turf, _);
