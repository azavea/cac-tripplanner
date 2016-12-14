CAC.Map.ItineraryControl = (function ($, Handlebars, cartodb, L, turf, _) {
    'use strict';

    var map = null;
    var itineraries = {};

    var events = $({});
    var eventNames = {
        waypointMoved: 'cac:map:control:waypointmoved',
        waypointsSet: 'cac:map:control:waypointsset'
    };
    var lastItineraryHoverMarker = null;
    var itineraryHoverListener = null;
    var liveUpdatingItinerary = false; // true when live update request sent but not completed
    var waypointsLayer = null;

    var waypointRadius = 6;
    var waypointFillColor = 'white';
    var waypointStrokeColor = '#d02d2d';
    var waypointStrokeWidth = 4;
    var waypointCircle = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ' +
        'width="' + (waypointRadius + waypointStrokeWidth) * 2 +
        '" height="' + (waypointRadius + waypointStrokeWidth) * 2 + '">' +
        '<circle cx="' + (waypointRadius + waypointStrokeWidth) +
        '" cy="' + (waypointRadius + waypointStrokeWidth) +
        '" r="' + waypointRadius + '" fill="' + waypointFillColor +
        '" stroke="' + waypointStrokeColor +
        '" stroke-width="' + waypointStrokeWidth + '"/></svg>';
    var waypointIcon = L.icon( {
        iconUrl: 'data:image/svg+xml;base64,' + btoa(waypointCircle),
        iconSize: [(waypointRadius + waypointStrokeWidth) * 2, (waypointRadius + waypointStrokeWidth) * 2],
        popupAnchor: [60, 40]
    } );

    function ItineraryControl(options) {
        this.events = events;
        this.eventNames = eventNames;
        map = options.map;
    }

    ItineraryControl.prototype.plotItinerary = plotItinerary;
    ItineraryControl.prototype.clearItineraries = clearItineraries;
    ItineraryControl.prototype.clearWaypointInteractivity = clearWaypointInteractivity;
    ItineraryControl.prototype.draggableItinerary = draggableItinerary;
    ItineraryControl.prototype.updateItineraryLayer = updateItineraryLayer;
    ItineraryControl.prototype.errorLiveUpdatingLayer = errorLiveUpdatingLayer;
    ItineraryControl.prototype.setMap = setMap;

    return ItineraryControl;

    function setMap(newMap) {
        map = newMap;
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
                    }).bindPopup('Drag to change route', {closeButton: false}
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
                            }, 500);
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
                                                               draggable: true});
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

            marker.bindPopup('Drag to change. Click to remove.', {closeButton: false})
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
        _.forEach(itineraries, function (itinerary) {
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

        _.forEach(itineraries, function (itinerary) {
            itinerary.geojson.off('mouseover', itineraryHoverListener);
        });
    }

})(jQuery, Handlebars, cartodb, L, turf, _);
