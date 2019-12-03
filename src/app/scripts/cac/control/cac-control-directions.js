/**
 *  View control for the directions form
 *
 */
CAC.Control.Directions = (function (_, $, moment, Control, Places, Routing, UserPreferences, Utils) {

    'use strict';

    // Number of milliseconds to wait on input changes before sending directions request
    var DIRECTION_THROTTLE_MILLIS = 750;

    // Number of milliseconds to wait on destination list reorder before requerying directions
    var REORDER_TOUR_THROTTLE_MILLIS = 500;

    var defaults = {
        selectors: {
            directions: '.directions-results',
            hiddenClass: 'hidden',
            itineraryBlock: '.route-summary',
            places: '.places',
            selectedClass: 'selected',
            spinner: '.directions-results > .sk-spinner',
            tourDestinationBlock: '.place-card',
            visible: ':visible'
        }
    };
    var options = {};

    var planTripRequest = null;
    var OUTDATED_REQUEST_ERROR = 'outdated request';

    var currentDestination = null;
    var currentItinerary = null;
    var showBackToTourButton = false;
    var tour = null;

    var directions = {
        origin: null,
        destination: null
    };

    var mapControl = null;
    var itineraryControl = null;
    var exploreControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsFormControl = null;
    var directionsListControl = null;
    var itineraryListControl = null;
    var tourListControl = null;

    function DirectionsControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;
        exploreControl = options.exploreControl;
        itineraryControl = mapControl.itineraryControl;
        urlRouter = options.urlRouter;
        directionsFormControl = options.directionsFormControl;

        mapControl.events.on(mapControl.eventNames.originMoved, originDestinationMoveStart);
        mapControl.events.on(mapControl.eventNames.destinationMoved, originDestinationMoveStart);

        directionsFormControl.events.on(directionsFormControl.eventNames.selected,
                                        onTypeaheadSelected);
        directionsFormControl.events.on(directionsFormControl.eventNames.cleared,
                                        onTypeaheadCleared);
        directionsFormControl.events.on(directionsFormControl.eventNames.reversed,
                                        reverseOriginDestination);
        directionsFormControl.events.on(directionsFormControl.eventNames.geocodeError,
                                        onGeocodeError);

        tabControl.events.on(tabControl.eventNames.tabShown, onTabShown);

        directionsListControl = new Control.DirectionsList({
            showBackButton: true,
            showShareButton: true,
            selectors: {
                container: options.selectors.itineraryList
            }
        });
        directionsListControl.events.on(directionsListControl.eventNames.backButtonClicked,
                                        onDirectionsBackClicked);

        itineraryListControl = new Control.ItineraryList();
        itineraryListControl.events.on(itineraryListControl.eventNames.itineraryClicked,
                                       onItineraryClicked);
        itineraryListControl.events.on(itineraryListControl.eventNames.itineraryHover,
                                       onItineraryHover);

        itineraryControl.events.on(itineraryControl.eventNames.itineraryHovered,
                                   onTourItineraryHover);
        itineraryControl.events.on(itineraryControl.eventNames.waypointsSet, queryWithWaypoints);
        itineraryControl.events.on(itineraryControl.eventNames.waypointMoved, liveUpdateItinerary);

        // Listen to direction hovered events in order to show a point on the map
        directionsListControl.events.on(
            directionsListControl.eventNames.directionHovered,
            function(e, lon, lat) {
                mapControl.displayPoint(lon, lat);
        });

        tourListControl = new Control.TourList();

        tourListControl.events.on(
            tourListControl.eventNames.destinationHovered, onTourDestinationHover);

        tourListControl.events.on(tourListControl.eventNames.destinationClicked,
            function(e,
                     isEvent, originPlaceId, originAddress, originX, originY,
                     destinationPlaceId, destinationAddress, destinationX, destinationY) {
                // push tour map page into browser history first
                urlRouter.pushDirectionsUrlHistory();
                // locally track that directions navigated to from a tour, to show back button
                showBackToTourButton = !isEvent;
                UserPreferences.setPreference('placeId', destinationPlaceId);
                var originLocation = {
                    id: originPlaceId,
                    address: originAddress,
                    location: {x: originX, y: originY}
                };
                var destinationLocation = {
                    id: destinationPlaceId,
                    address: destinationAddress,
                    location: {x: destinationX, y: destinationY}
                };
                // Set the origin without triggering requery; keeps tour last in history
                if (originX && originY) {
                    directionsFormControl.setStoredLocation('origin', originLocation);
                    setDirections('origin', [originY, originX]);
                }
                directionsFormControl.setLocation('destination', destinationLocation);
                tabControl.setTab(tabControl.TABS.DIRECTIONS);
                if (!originX && !UserPreferences.getPreference('origin')) {
                    directionsFormControl.setError('origin');
                    $(options.selectors.originInput).focus();
                    // Hide spinner if trying to get directions without an origin
                    $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
                }
        });

        tourListControl.events.on(tourListControl.eventNames.destinationsReordered,
            function(e, destinations) {
                reorderTourDestinations(destinations);
        });
    }

    DirectionsControl.prototype = {
        setDirections: setDirections,
        setOptions: setOptions,
        setFromUserPreferences: setFromUserPreferences
    };

    /**
     * Set user preferences before planning trip.
     * Throttled to cut down on requests.
     */
    var planTrip = _.debounce(function() {  // jshint ignore:line
        // show spinner while loading
        showSpinner();
        showPlaces(false);
        var tourMode = UserPreferences.getPreference('tourMode');
        var useInitialWaypoint = false;
        var origin = directions.origin;
        if (tourMode === 'event') {
            // Show destinations and their markers but do not route
            tourListControl.setTourDestinations(tour);
            $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
            tourListControl.show();
            itineraryControl.clearItineraries();
            mapControl.setDirectionsMarkers(null, null, true);
            mapControl.isochroneControl.drawDestinations(tour.destinations,
                _.flatMap(tour.destinations, 'id'), true, true);
            updateUrl();
            return;
        } else if (tourMode === 'tour' && !origin && tour &&
                   tour.destinations && tour.destinations.length) {
            // Viewing a tour with no origin set, implicitly use first destination
            // without displaying it in the form.
            origin = tour.destinations[0];
            origin = [origin.location.y, origin.location.x];
            useInitialWaypoint = true;
        }

        if (!(origin && directions.destination)) {
            directionsFormControl.setError('origin');
            directionsFormControl.setError('destination');

            // Still update the URL and show marker if they request one-sided directions
            updateUrl();

            mapControl.setDirectionsMarkers(origin, directions.destination, true);
            $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
            itineraryListControl.setItineraries(null);
            itineraryListControl.show();
            showBackToTourButton = false;
            return;
        }

        directionsFormControl.clearFocus();

        var date = UserPreferences.getPreference('dateTime');
        date = date ? moment.unix(date) : moment(); // default to now

        var otpOptions = getOtpOptions();

        // set user preferences
        UserPreferences.setPreference('method', 'directions');

        // Most changes trigger this function, so doing this here keeps the URL mostly in sync
        updateUrl();

        // If using first tour destination as implicit origin,
        // remove it from waypoints *after* upating URL.
        if (useInitialWaypoint) {
            otpOptions.waypoints.shift();
        }

        tabControl.setTab(tabControl.TABS.DIRECTIONS);

        // If a previous request is in progress, cancel it before issuing the new one.
        // Prevents callbacks being executed out of order.
        if (planTripRequest) {
            planTripRequest.reject(Error(OUTDATED_REQUEST_ERROR));
        }

        planTripRequest = Routing.planTrip(origin,
                                           directions.destination,
                                           date,
                                           otpOptions,
                                           true);


        planTripRequest.then(function (itineraries) {
            itineraryControl.clearItineraries();
            // Only use first itinerary in tour mode
            if (tourMode && itineraries.length) {
                currentItinerary = itineraries[0];
                itineraryControl.plotItinerary(currentItinerary, true);
                currentItinerary.show(true);
            } else if (!tourMode) {
                // Add the itineraries to the map, highlighting the first one
                var isFirst = true;
                _.forEach(itineraries, function (itinerary) {
                    itineraryControl.plotItinerary(itinerary, isFirst);
                    itinerary.highlight(isFirst);
                    if (isFirst) {
                        currentItinerary = itinerary;
                        isFirst = false;
                    }
                });
            }

            currentItinerary.geojson.bringToFront();

            // If there is only one itinerary, make it draggable.
            // Only one itinerary is returned if there are waypoints, so this
            // lets the user to continue to add or modify waypoints without
            // having to select it in the list.
            if (!currentItinerary.tourMode && itineraries.length === 1 &&
                !UserPreferences.getPreference('arriveBy')) {

                itineraryControl.draggableItinerary(currentItinerary);
            }

            if (currentItinerary.tourMode) {
                itineraryControl.tourItinerary(currentItinerary,
                                               tour.destinations,
                                               useInitialWaypoint);
            }

            // snap start and end points to where first itinerary starts and ends
            // (in case one or both markers is someplace unroutable, like in a river)
            directions.destination = [currentItinerary.to.lat, currentItinerary.to.lon];
            updateLocationPreferenceWithDirections('destination');
            if (!useInitialWaypoint) {
                // Only update origin if it isn't the first destination of a tour
                directions.origin = [currentItinerary.from.lat, currentItinerary.from.lon];
                updateLocationPreferenceWithDirections('origin');
                origin = directions.origin;
            }
            // put markers at start and end, if set by user
            if (!currentItinerary.tourMode) {
                mapControl.setDirectionsMarkers(directions.origin, directions.destination);
            } else if (directions.origin) {
                mapControl.setDirectionsMarkers(directions.origin, null);
            }

            if (currentItinerary.tourMode) {
                tourListControl.setTourDestinations(tour);
                $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
                tourListControl.show();
            } else {
                itineraryListControl.setItineraries(itineraries);
                $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
                itineraryListControl.show();
                if (showBackToTourButton && itineraries && itineraries.length > 0) {
                    itineraryListControl.showBackButton();
                }
                // highlight first itinerary in sidebar as well as on map
                findItineraryBlock(currentItinerary.id)
                    .addClass(options.selectors.selectedClass);
            }
            showBackToTourButton = false;
        }, function (error) {
            // Cancelled requests are expected; do not display an error message to user.
            // Just keep showing the loading animation until a subsequent request completes.
            if (error && error.message === OUTDATED_REQUEST_ERROR) {
                return;
            }

            console.error('failed to plan trip');
            console.error(error);
            $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
            itineraryControl.clearItineraries();
            itineraryListControl.setItinerariesError(error);
            itineraryListControl.show();
        });
    }, DIRECTION_THROTTLE_MILLIS, {leading: true, trailing: true});

    /**
     * Reorder tour destination waypoints and end point and requery for directions.
     * Throttled to cut down on requests.
     */
    var reorderTourDestinations = _.debounce(function(destinations) {  // jshint ignore:line
        tour.destinations = destinations;
        itineraryControl.clearItineraries();
        mapControl.setDirectionsMarkers(null, null, true);
        onTypeaheadSelectDone('destination', destinations);
    }, REORDER_TOUR_THROTTLE_MILLIS, {leading: false, trailing: true});

    return DirectionsControl;

    function onTabShown(event, tabId) {
        if (tabId === tabControl.TABS.DIRECTIONS) {
            UserPreferences.setPreference('method', 'directions');
            setFromUserPreferences();
            // If user toggled away from tab and came back before a directions
            // query could resolve, show spinner again.
            if (planTripRequest) {
                showSpinner();
            }
        } else {
            clearItineraries();
            showPlaces(true);
        }
    }

    function clearItineraries() {
        if (!UserPreferences.getPreference('tourMode')) {
            UserPreferences.setPreference('waypoints', undefined);
        }
        itineraryControl.clearItineraries();
        mapControl.setDirectionsMarkers(null, null);
        if (mapControl.isochroneControl) {
            mapControl.isochroneControl.clearDestinations();
        }
        itineraryListControl.hide();
        directionsListControl.hide();
    }

    function showSpinner() {
        showPlaces(false);
        itineraryListControl.hide();
        directionsListControl.hide();
        tourListControl.hide();
        $(options.selectors.spinner).removeClass(options.selectors.hiddenClass);
    }

    // Helper to call plan trip if a destination is set,
    // or show list of event destinations without routing,
    // or show places list if no destination and not an event.
    function planTripOrShowPlaces() {
        if (directions.destination ||
            UserPreferences.getPreference('tourMode') === 'tour') {
            showPlaces(false);
            planTrip();
        } else {
            showPlaces(true);
            exploreControl.getNearbyPlaces();
        }
    }

    /**
     * Get parameters to pass to OpenTripPlanner, based on current settings
     *
     * @returns {Object} extra parameter set to pass to Routing.planTrip
     */
    function getOtpOptions() {
        var mode = UserPreferences.getPreference('mode');
        var arriveBy = UserPreferences.getPreference('arriveBy');

        var otpOptions = {
            arriveBy: arriveBy,
            maxWalkDistance: UserPreferences.getPreference('maxWalk'),
            tourMode: UserPreferences.getPreference('tourMode')
        };

        // add intermediatePlaces if user edited route or in tour mode
        var waypoints = UserPreferences.getPreference('waypoints');
        if (waypoints && waypoints.length && !arriveBy) {
            otpOptions.waypoints = waypoints;
        }

        if (mode.indexOf('BICYCLE') > -1) {
            // set bike trip optimization option
            var bikeOptimize = UserPreferences.getPreference('bikeOptimize');
            if (bikeOptimize) {
                $.extend(otpOptions, {optimize: bikeOptimize});
            }
        } else {
            $.extend(otpOptions, { wheelchair: UserPreferences.getPreference('wheelchair'),
                                   optimize: 'GREENWAYS' });
        }

        $.extend(otpOptions, {
            mode: mode,
            fromText: UserPreferences.getPreference('originText'),
            toText: UserPreferences.getPreference('destinationText')
        });

        return otpOptions;
    }

    function onDirectionsBackClicked() {
        // show directions list again
        showPlaces(false);
        // show the other itineraries again
        itineraryListControl.showItineraries(true);
        currentItinerary.highlight(true);
        directionsListControl.hide();
        itineraryListControl.show();
        mapControl.fitToBounds(currentItinerary.geojson.getBounds());
    }

    /**
     * Handles click events to select a given itinerary
     */
    function onItineraryClicked(event, itinerary) {
        // hide both the directions list and the places list
        $(options.selectors.directions).hide();
        $(options.selectors.places).hide();
        if (itinerary) {
            // hide all other itineraries
            itineraryListControl.showItineraries(false);
            itinerary.show(true);
            itinerary.highlight(true);

            // TODO: alert user that cannot use waypoints with arriveBy
            if (!UserPreferences.getPreference('arriveBy')) {
                itineraryControl.draggableItinerary(itinerary);
            }

            currentItinerary = itinerary;
            itinerary.geojson.bringToFront();
            directionsListControl.setItinerary(itinerary);
            itineraryListControl.hide();
            tourListControl.hide();
            directionsListControl.show();
            mapControl.fitToBounds(itinerary.geojson.getBounds());
        }
    }

    function findItineraryBlock(id) {
        return $(options.selectors.itineraryBlock + '[data-itinerary="' + id + '"]');
    }

    function findTourDestinationBlock(id) {
        return $(options.selectors.tourDestinationBlock + '[data-tour-place-id="' + id + '"]');
    }

    /**
     * Handles hover events to highlight a given itinerary
     */
    function onItineraryHover(event, itinerary) {
        if (itinerary) {
            findItineraryBlock(currentItinerary.id)
                .removeClass(options.selectors.selectedClass);
            findItineraryBlock(itinerary.id).addClass(options.selectors.selectedClass);
            currentItinerary.highlight(false);
            itinerary.highlight(true);
            currentItinerary = itinerary;
            itinerary.geojson.bringToFront();
        }
    }

    function onTourItineraryHover(event, nextWaypoint) {
        if (_.isNull(nextWaypoint)) {
            onTourDestinationHover(event, null);
            return;
        }

        if (directions.origin) {
            nextWaypoint -= 1;
        }
        onTourDestinationHover(event, tour.destinations[nextWaypoint]);
    }

    /**
     * Handles hover events to highlight a given tour or event destination
     */
    function onTourDestinationHover(event, destination) {
        var tourMode = UserPreferences.getPreference('tourMode');
        if (destination) {
            var order = destination.userOrder ? destination.userOrder : destination.order;
            // Highlight marker
            if (tourMode === 'tour') {
                itineraryControl.highlightTourMarker(order - 1);
            } else if (tourMode === 'event') {
                mapControl.isochroneControl.highlightEventMarker(destination.id);
            }
            // If first waypoint is used as origin, do not highlight a segment for it.
            if (!directions.origin) {
                order -= 1;
            }
            // Also highlight itinerary segment for tours
            if (tourMode === 'tour') {
                currentItinerary.geojson.eachLayer(function(layer) {
                    var highlight = layer.feature.properties.nextWaypoint === order;
                    layer.setStyle({
                        color: highlight ?
                            Utils.tourHighlightColor : Utils.defaultBackgroundLineColor,
                        dashArray: highlight ?
                            null : Utils.dashArray
                    });
                    if (highlight) {
                        layer.bringToFront();
                    }
                });
            }
            if (currentDestination) {
                findTourDestinationBlock(currentDestination.id)
                    .removeClass(options.selectors.selectedClass);
            }
            findTourDestinationBlock(destination.id).addClass(options.selectors.selectedClass);
            currentDestination = destination;
        } else if (currentDestination) {
            // un-highlight last destination on hover out
            findTourDestinationBlock(currentDestination.id)
                    .removeClass(options.selectors.selectedClass);
            currentDestination = null;
            if (tourMode === 'tour') {
                currentItinerary.geojson.setStyle({color: Utils.defaultBackgroundLineColor,
                                                   dashArray: Utils.dashArray});
                itineraryControl.unhighlightTourMarker();
            } else if (tourMode === 'event') {
                mapControl.isochroneControl.unhighlightEventMarker();
            }
        }
    }

    function liveUpdateItinerary(event, itinerary) {
        var oldLayer = itinerary.geojson;
        Routing.planLiveUpdate(itinerary).then(function(newItinerary) {
            itineraryControl.updateItineraryLayer(oldLayer, newItinerary);
        }, function(error) {
            console.error(error);
            // occasionally cannot plan route if waypoint cannot be snapped to street grid
            itineraryControl.errorLiveUpdatingLayer();
        });
    }

    /**
     * Initiate a trip plan when user finishes editing a route.
     */
    function queryWithWaypoints(event, points) {
        UserPreferences.setPreference('waypoints', points.waypoints);
        showPlaces(false);
        planTrip();
    }

    // trigger re-query when trip options update
    function setOptions() {
        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            planTripOrShowPlaces();
        }
    }

    function reverseOriginDestination(event, newOrigin, newDestination) {
        // set on this object and validate
        if (newOrigin && newOrigin.location) {
            setDirections('origin', [newOrigin.location.y, newOrigin.location.x]);
        } else {
            setDirections('origin', null);
        }

        if (newDestination && newDestination.location) {
            setDirections('destination', [newDestination.location.y, newDestination.location.x]);
        } else {
            setDirections('destination', null);
        }

        // Set error on origin if it is a tour
        if (tour && tour.name === newOrigin.address && tour.id.indexOf('tour') > -1) {
            UserPreferences.setPreference('origin', null);
            UserPreferences.setPreference('tourMode', '');
            directionsFormControl.setError('origin');
            $(options.selectors.originInput).focus();
            clearItineraries();
            updateUrl();
            return;
        }

        // update the directions for the reverse trip
        planTripOrShowPlaces();
    }

    function onTypeaheadCleared(event, key) {
        if (key === 'origin') {
            var tourMode = UserPreferences.getPreference('tourMode');

            if (tourMode === 'event') {
                itineraryControl.clearItineraries();
                mapControl.setDirectionsMarkers(null, null);
                directions[key] = null;
                return;
            }
        }

        clearItineraries();
        directions[key] = null;

        // Plan tour trip with first destination as implicit origin
        if (UserPreferences.getPreference('tourMode') === 'tour' &&
            tour && tour.destinations && tour.destinations.length) {

            planTripOrShowPlaces();
        }

        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            mapControl.clearDirectionsMarker(key);
            // only load destinations list in directions mode when destination field empty
            if (key === 'destination') {
                showPlaces(true);
                exploreControl.getNearbyPlaces();
            }
        }
    }

    /**
     * Helper to finish `onTypeaheadSelected` event

     * @param key {String} Either 'origin' or 'destination'
     * @param destinations {Array} List of places, the last of which is the final destination.
     *                             Can be a single destination, but cannot be empty.
     */
    function onTypeaheadSelectDone(key, destinations) {
        if (destinations && destinations.length > 0) {
            var places = Object.assign([], destinations);
            var end = places.pop();
            setDirections(key, [end.location.y, end.location.x]);

            // Tour mode is not applicable to origin
            if (key === 'destination') {
                var waypoints = _.map(places, function(d) {
                    return [d.location.y, d.location.x];
                });

                // Set waypoints after `setDirections`, which clears waypoints
                if (waypoints && waypoints.length) {
                    UserPreferences.setPreference('waypoints', waypoints);
                    updateUrl();
                }
            }
        }

        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            planTripOrShowPlaces();
        }
    }

    function onTypeaheadSelected(event, key, result) {
        if (!result) {
            setDirections(key, null);
            return;
        }

        // Tour mode does not apply to origin
        if (key === 'origin') {
            onTypeaheadSelectDone(key, [result]);
            return;
        }
        // If the typeahead result is a tour, go into tour mode
        // and route between multiple destinations instead of to a single one.
        // If an event, present the destinations like with a tour, but do not route.
        var isTourMode = !!(result.id && result.id.indexOf('tour') > -1);
        var isEventMode = !!(result.id && result.id.indexOf('event') > -1);
        // Single-destination events that came from Typeahead go straight to directions
        if (isEventMode && result.destinations && result.destinations.length === 1) {
            isEventMode = false;
        }

        var tourModePreference = isTourMode ? 'tour' : (isEventMode ? 'event' : false);
        UserPreferences.setPreference('tourMode', tourModePreference);

        if (!tourModePreference) {
            // Send the single destination.
            onTypeaheadSelectDone(key, [result]);
            return;
        } else {
            tour = null;
        }

        if (result.destinations) {
            // Result came from Typeahead, and so already has full destinations
            // results from API search endpoint.
            // If result did not come from Typeahead, the full tour will be
            // loaded in the Places query in setFromUserPreferences.
            result.address = result.name;
            directionsFormControl.setStoredLocation('destination', result);
            tour = result;
            onTypeaheadSelectDone(key, result.destinations);
        }
    }

    // If they move a marker, that invalidates the old itineraries and triggers the form to
    // reverse geocode the new location, so show the spinner while that happens.
    function originDestinationMoveStart() {
        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            showSpinner();
        }
    }

    // If they dragged the origin or destination and the location failed to geocode, show error
    function onGeocodeError(event, key) {
        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            setDirections(key, null);
            $(options.selectors.spinner).addClass('hidden');
            itineraryListControl.setItinerariesError({
                msg: 'Could not find street address for location.'
            });
            itineraryListControl.show();
        }
    }

    function setDirections(key, value) {
        // skip clearing sidebar or markers in tour mode
        if (key === 'origin' && !value && UserPreferences.getPreference('tourMode')) {
            itineraryControl.clearItineraries();
            mapControl.setDirectionsMarkers(null, null);
            directions[key] = value;
            return;
        }

        clearItineraries();
        if (key === 'origin' || key === 'destination') {
            directions[key] = value;
            if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
                directionsFormControl.setError(key);
            }
        } else {
            console.error('Directions key ' + key + 'unrecognized!');
        }
    }

    // toggles between showing directions tab content or places list (explore mode content)
    function showPlaces(doShowPlaces) {
        if (doShowPlaces) {
            $(options.selectors.directions).hide();
            mapControl.isochroneControl.clearDestinations();
            $(options.selectors.places).show();
        } else {
            $(options.selectors.directions).show();
            $(options.selectors.places).hide();
        }
    }

    // Updates the URL to match the currently-selected options
    function updateUrl() {
        // If we're missing some direction preferences in the URL, we'll update
        // the URL to include them.
        // Replace url state in this case to avoid an infinite loop in browser history
        var replaceUrlState = urlRouter.directionsPrefsMissingFromUrl();
        urlRouter.updateUrl(urlRouter.buildDirectionsUrlFromPrefs(), replaceUrlState);
    }

    /** Helper to save current directions origin or destination to user preferences.
     *
     * @param key {String} Either 'origin' or 'destination'
     */
    function updateLocationPreferenceWithDirections(key) {
        var preferenceLocation = UserPreferences.getPreference(key);

        if (!directions[location] || directions[location].length < 2) {
            return;
        }

        var newLocationY = directions[location][0];
        var newLocationX = directions[location][1];

        preferenceLocation.location = {
            x: newLocationX,
            y: newLocationY
        };

        preferenceLocation.extent = {
            xmax: newLocationX,
            xmin: newLocationX,
            ymax: newLocationY,
            ymin: newLocationY
        };

        // update location in user preferences, but not the string for it
        UserPreferences.setPreference(location, preferenceLocation);
    }

    /**
     * When first navigating to the page, check if origin and destination already set.
     * Go directly to trip plan if so.
     */
    function setFromUserPreferences() {
        var origin = UserPreferences.getPreference('origin');
        var destination = UserPreferences.getPreference('destination');
        var tourMode = UserPreferences.getPreference('tourMode');

        if (origin && origin.location) {
            directions.origin = [origin.location.y, origin.location.x];
        } else if (tourMode === 'tour') {
            // Support using browser history to return to a tour without an origin set
            directions.origin = null;
            directionsFormControl.setStoredLocation('origin', null);
        }

        if (destination && destination.location) {
            directions.destination = [destination.location.y, destination.location.x];
        }

        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            // get nearby places if no destination has been set yet, or get directions
            // Fetch tour destinations on tour directions page (re)load
            if (tourMode && destination) {
                showSpinner();
                Places.queryPlaces(null, destination.address).then(function(data) {
                    tour = null;
                    if (tourMode === 'tour' && data.tours && data.tours.length) {
                        tour = _.find(data.tours, function(tour) {
                            return tour.name === destination.address;
                        });
                        if (tour) {
                            // Match format of Typeahead response
                            tour.id = 'tour_' + tour.id;
                        }
                        // Reset the tour to clear changes to order or removed destinations
                        tourListControl.clearTour();
                    } else if (tourMode === 'event' && data.events && data.events.length) {
                        tour = data.events[0];
                        // Go directly to route for single-destination events
                        if (tour.destinations && tour.destinations.length === 1) {
                            UserPreferences.setPreference('tourMode', false);
                            tour = null;
                            onTypeaheadSelectDone('destination', [data.events[0]]);
                            return;
                        }
                    }
                    if (tour) {
                        onTypeaheadSelectDone('destination', tour.destinations);
                    } else {
                        console.error('Failed to find destinations for tour ' + destination.address);
                        planTripOrShowPlaces();
                    }
                }).fail(function(error) {
                    console.error('Error querying for tour destinations:');
                    console.error(error);
                    planTripOrShowPlaces();
                });
            } else {
                // Not a tour; go to plan route
                planTripOrShowPlaces();
            }
        } else {
            // explore tab visible
            showPlaces(true);
        }
    }

})(_, jQuery, moment, CAC.Control, CAC.Places.Places, CAC.Routing.Plans, CAC.User.Preferences, CAC.Utils);
