CAC.Map.Control = (function ($, Handlebars, cartodb, L, turf, _) {
    'use strict';

    var defaults = {
        id: 'map',
        homepage: true,
        center: [39.95, -75.1667],
        zoom: 14,
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
        currentLocationClick: 'cac:map:control:currentlocation',
        originMoved: 'cac:map:control:originmoved',
        destinationMoved: 'cac:map:control:destinationmoved',
        geocodeMarkerMoved: 'cac:map:control:geocodemoved',
        waypointMoved: 'cac:map:control:waypointmoved',
        waypointsSet: 'cac:map:control:waypointsset'
    };
    var basemaps = {};
    var overlays = {};
    var lastDisplayPointMarker = null;
    var lastItineraryHoverMarker = null;
    var itineraryHoverListener = null;
    var liveUpdatingItinerary = false; // true when live update request sent but not completed
    var waypointsLayer = null;

    var layerControl = null;
    var tabControl = null;
    var zoomControl = null;

    var homepage = true; // whether currently displaying home page view TODO: rework

    var waypointRadius = 6;
    var waypointColor = '#444';
    var waypointCircle = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ' +
        'width="' + waypointRadius * 2 + '" height="' + waypointRadius * 2 + '">' +
        '<circle cx="' + waypointRadius + '" cy="' + waypointRadius +
        '" r="' + waypointRadius + '" fill="' + waypointColor + '"/></svg>';
    var waypointIcon = L.icon( {
        iconUrl: 'data:image/svg+xml;base64,' + btoa(waypointCircle),
        iconSize: [waypointRadius * 2, waypointRadius * 2],
        iconAnchor: [waypointRadius, waypointRadius],
        popupAnchor: [0, -2 - waypointRadius]
    } );

    var esriSatelliteAttribution = [
        '&copy; <a href="http://www.esri.com/">Esri</a> ',
        'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, ',
        'AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
    ].join('');
    var cartodbAttribution = [
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ',
        '&copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    ].join('');

    function MapControl(options) {
        this.events = events;
        this.eventNames = eventNames;
        this.options = $.extend({}, defaults, options);
        overlaysControl = new CAC.Map.OverlaysControl();
        map = new cartodb.L.map(this.options.id, { zoomControl: false })
            .setView(this.options.center, this.options.zoom);

        tabControl = options.tabControl;
        homepage = options.homepage;

        // put zoom control on top right
        zoomControl = new cartodb.L.Control.Zoom({ position: 'topright' });

        // hide zoom control on home page view
        if (!homepage) {
            zoomControl.addTo(map);
        }

        initializeBasemaps();
        initializeOverlays();
        initializeLayerControl();

        this.isochroneControl = new CAC.Map.IsochroneControl({map: map, tabControl: tabControl});

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

    MapControl.prototype.plotItinerary = plotItinerary;
    MapControl.prototype.clearItineraries = clearItineraries;
    MapControl.prototype.clearWaypointInteractivity = clearWaypointInteractivity;
    MapControl.prototype.draggableItinerary = draggableItinerary;
    MapControl.prototype.setGeocodeMarker = setGeocodeMarker;
    MapControl.prototype.setDirectionsMarkers = setDirectionsMarkers;
    MapControl.prototype.clearDirectionsMarker = clearDirectionsMarker;
    MapControl.prototype.displayPoint = displayPoint;
    MapControl.prototype.updateItineraryLayer = updateItineraryLayer;
    MapControl.prototype.errorLiveUpdatingLayer = errorLiveUpdatingLayer;

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

        // TODO: handle hiding layers on home view more cleanly.
        // Would be better to initialize but not add to map, to avoid flashing,
        // although it probably won't be visible due to centering of home page text.
        if (homepage) {
            overlays['Bike Share Locations'].eachLayer(function(layer) { layer.hide(); });
            overlays['Bike Routes'].eachLayer(function(layer) { layer.hide(); });
        }

        // TODO: re-enable when Uwishunu feed returns
        //overlays['Nearby Events'] = overlaysControl.nearbyEventsOverlay();
        //overlays['Nearby Events'].addTo(map);
    }

    function initializeLayerControl() {
        layerControl = cartodb.L.control.layers(basemaps, overlays, {
            position: 'bottomright',
            collapsed: false
        });

        if (!homepage) {
            layerControl.addTo(map);
        }
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

        /**
         * Show a draggable marker on the route line that adds a waypoint when released.
         * Throttles calls to the trip planner for live updates; fires event when live update done.
         *
         * @param {object} event Leaflet drag event (that has coordinates on it)
         * @param {integer} index Offset of waypoint to add or move within ordered waypoint list
         * @param {boolean} isNew Whether this is a new waypoint to add, or move existing if false
         */
        var redrawWaypointDrag = _.throttle(function(event, index, isNew) { // jshint ignore:line
            if (liveUpdatingItinerary) {
                return; // do not send another request if one already in progress
            }

            liveUpdatingItinerary = true;
            var coords = event.target.getLatLng();
            var lastItinerary = itineraries[itinerary.id];
            var waypoints;
            if (isNew) {
                // adding new waypoint
                waypoints = addWaypoint(lastItinerary, [coords.lat, coords.lng], index);
            } else {
                // dragging existing waypoint
                waypoints = updateWaypointList(lastItinerary, index, [coords.lat, coords.lng]);
            }
            lastItinerary.routingParams.extraOptions.waypoints = waypoints;
            events.trigger(eventNames.waypointMoved, lastItinerary);
        }, 800, {leading: true, trailing: true});

        // Leaflet listeners are removed by reference, so retain a reference to the
        // listener function to be able to turn it off later.
        itineraryHoverListener = function(e) {
            if (lastItineraryHoverMarker) {
                lastItineraryHoverMarker.setLatLng(e.latlng, {draggable: true});
            } else {
                // flag if user currently dragging out a new waypoint or not
                var dragging = false;
                // index for new waypoint, based on where user began dragging
                var newWaypointIndex = null;
		        // Use a timeout when closing the popup so it doesn't strobe on extraneous mouseouts
                var popupTimeout;
                // The marker closes with a timeout as well, and holding onto it lets us avoid
                // removing the marker while it's still under the mouse
                var markerTimeout;
                lastItineraryHoverMarker = new cartodb.L.Marker(e.latlng, {
                        draggable: true,
                        icon: waypointIcon
                    }).bindPopup('Drag marker to change route', {closeButton: false}
                    ).on('dragstart', function(e) {
                        dragging = true;
                        var pt = e.target.getLatLng();
                        var startDragPoint = [pt.lng, pt.lat];
                        newWaypointIndex = getNewWaypointIndex(itinerary, startDragPoint);
                    }).on('dragend', function(e) {
                        dragging = false;
                        // cancel any live route updates queued
                        redrawWaypointDrag.cancel();
                        var coords = e.target.getLatLng();
                        setAddedWaypoint(itinerary, [coords.lat, coords.lng], newWaypointIndex);
                        newWaypointIndex = null;
                    }).on('drag', function(event) {
                        // get itinerary from collection to pick up newer version with
                        // layer modified by live dragging updates
                        redrawWaypointDrag(event, newWaypointIndex, true);
                    }).on('mouseover', function() {
                        clearTimeout(popupTimeout);
                        clearTimeout(markerTimeout);
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
                        if (!dragging) {
                            markerTimeout = setTimeout(function() {
                                if (lastItineraryHoverMarker && !dragging) {
                                    map.removeLayer(lastItineraryHoverMarker);
                                    lastItineraryHoverMarker = null;
                                    dragging = false;
                                    newWaypointIndex = null;
                                }
                            }, 3000);
                        }
                    });

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
                    var marker = new cartodb.L.marker(latlng, {icon: waypointIcon,
                                                               draggable: true });
                    marker.on('dragstart', function() {
                        dragging = true;
                    }).on('dragend', function(e) {
                        dragging = false;
                        // cancel any live route updates queued
                        redrawWaypointDrag.cancel();
                        // get itinerary from collection to pick up newer version with
                        // layer modified by live dragging updates
                        var coords = e.target.getLatLng();
                        moveWaypoint(itineraries[itinerary.id],
                                     geojson.properties.index,
                                     [coords.lat, coords.lng]);
                    }).on('click', function() {
                        removeWaypoint(itinerary, geojson.properties.index);
                    }).on('drag', function(event) {
                            redrawWaypointDrag(event, geojson.properties.index, false);
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

        // Explicitly bring selected layer to foreground.
        // Fixes issue with Firefox inconsistently adding/removing interactivity
        // when there are multiple overlapping itinerary paths.
        itinerary.geojson.bringToFront();
    }

    function getNewWaypointIndex(itinerary, startDragPoint) {
        var waypoints = itinerary.waypoints;

        if (!waypoints || !waypoints.length) {
            return 0;
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

        return newIndex;
    }

    /**
     * Add a waypoint. If there is one or more existing waypoints, add the waypoint
     * at the provided index, which should be between the two nearest points to where
     * the user began the route edit on the linestring.
     * Adds the new point to the sequence of waypoints + origin and destination points,
     * which are ordered from origin to destination.
     *
     * @param {Object} itinerary CAC.Routing.Itinerary object with waypoint to move
     * @param {array} newWaypoint coordinates as [lat, lng] for waypoint to add
     * @param {number} newWaypointIndex Offset where new waypoint should be added in the
     *                 ordered list of waypoints
     */
    function addWaypoint(itinerary, newWaypoint, newWaypointIndex) {

        // note that it is important to not mutate itinerary.waypoints here
        var waypoints = itinerary.waypoints;

        if (!waypoints || !waypoints.length) {
            // first waypoint added; no need to interpolate with existing waypoints
            return [newWaypoint];
        }

        // extract the coordinates for the existing waypoints
        var coordinates = _.map(waypoints, function(waypoint) {
            return _.map([waypoint.geometry.coordinates[1],
                         waypoint.geometry.coordinates[0]],
                         parseFloat);
        });

        // insert new waypoint into ordered points list
        coordinates = _.concat(_.slice(coordinates, 0, newWaypointIndex),
                               [newWaypoint],
                               _.slice(coordinates, newWaypointIndex));

        return coordinates;
    }

    function setAddedWaypoint(itinerary, newWaypoint, newWaypointIndex) {
        var waypoints = addWaypoint(itinerary, newWaypoint, newWaypointIndex);
        // ensure all itinerary layers are removed from the map
        removeItineraryLayers();
        // requery with the changed points as waypoints
        events.trigger(eventNames.waypointsSet, {waypoints: waypoints});
    }

    /**
     * Helper to get updated list of waypoints on waypoint drag or drag end.
     *
     * @param {Object} itinerary CAC.Routing.Itinerary object with waypoint to move
     * @param {integer} waypointIndex offset of waypoint to move
     * @param {array} newCoordinates [lat, lng] of new location for the waypoint
     */
    function updateWaypointList(itinerary, waypointIndex, newCoordinates) {

        // note that it is important to not mutate itinerary.waypoints here
        var waypoints = itinerary.waypoints;

        // should not happen, but sanity-check for waypoint indexing
        if (!waypoints || waypoints.length <= waypointIndex) {
            console.error('Could not find waypoint to move');
            return;
        }

        // extract the coordinates for the existing waypoints,
        // exchanging for new coordinates on moved waypoint
        return _.map(waypoints, function(waypoint, index) {
            if (index === waypointIndex) {
                return newCoordinates;
            } else {
                return _.map([waypoint.geometry.coordinates[1],
                             waypoint.geometry.coordinates[0]],
                             parseFloat);
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
        if (liveUpdatingItinerary) {
            liveUpdatingItinerary = false;
        }
        var coordinates = updateWaypointList(itinerary, waypointIndex, newCoordinates);

        // ensure all itinerary layers are removed from the map
        removeItineraryLayers();

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

    function updateItineraryLayer(oldLayer, newItinerary) {
        // If flag is false, dragged marker was released before this event could fire.
        // Remove the old layer and do not add the new one.
        if (!liveUpdatingItinerary) {
            map.removeLayer(oldLayer);
            return;
        }

        map.removeLayer(oldLayer);
        newItinerary.geojson.addTo(map);
        itineraries[newItinerary.id] = newItinerary;
        liveUpdatingItinerary = false;
    }

    function errorLiveUpdatingLayer() {
        liveUpdatingItinerary = false;
    }

    function clearItineraries() {
        clearWaypointInteractivity();
        _.forIn(itineraries, function (itinerary) {
            map.removeLayer(itinerary.geojson);
        });
        itineraries = {};
    }

    /**
     * Remove all itinerary map layers by inspecting for the GeoJSON `from` property.
     *
     * TODO: find better way to handle potential race conditions with live updating,
     * which mean itinerary layers cannot be reliably removed by using the dictionary of
     * itineraries stored in the map control during or on end of waypoint drag.
     */
    function removeItineraryLayers() {
        map.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties && layer.feature.properties.from) {
                map.removeLayer(layer);
            }
        });
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
