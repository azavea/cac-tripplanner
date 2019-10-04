/**
 *  View control for the directions form
 *
 */
CAC.Control.Directions = (function (_, $, moment, Control, Places, Routing, UserPreferences) {

    'use strict';

    // Number of millis to wait on input changes before sending directions request
    var DIRECTION_THROTTLE_MILLIS = 750;

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
            function(e, placeId, address, x, y) {
                showSpinner();
                showPlaces(false);
                // push tour map page into browser history first
                urlRouter.pushDirectionsUrlHistory();
                UserPreferences.setPreference('placeId', placeId);
                var location = {
                    id: placeId,
                    address: address,
                    location: {x: x, y: y}
                };
                directionsFormControl.setLocation('destination', location);
                tabControl.setTab(tabControl.TABS.DIRECTIONS);
                if (!UserPreferences.getPreference('origin')) {
                    directionsFormControl.setError('origin');
                    $(options.selectors.originInput).focus();
                    // Hide spinner if trying to get directions without an origin
                    $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
                }
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
        if (tourMode === 'event') {
            // Show event destinations and their markers but do not route
            tourListControl.setTourDestinations(tour);
            $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
            tourListControl.show();
            itineraryControl.clearItineraries();
            mapControl.setDirectionsMarkers(null, null, true);
            mapControl.isochroneControl.drawDestinations(tour.destinations,
                _.flatMap(tour.destinations, 'id'), true);
            updateUrl();
            return;
        } else if (!(directions.origin && directions.destination)) {
            directionsFormControl.setError('origin');
            directionsFormControl.setError('destination');

            // Still update the URL and show marker if they request one-sided directions
            updateUrl();
            mapControl.setDirectionsMarkers(directions.origin, directions.destination, true);
            $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
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

        tabControl.setTab(tabControl.TABS.DIRECTIONS);

        // If a previous request is in progress, cancel it before issuing the new one.
        // Prevents callbacks being executed out of order.
        if (planTripRequest) {
            planTripRequest.reject(Error(OUTDATED_REQUEST_ERROR));
        }

        planTripRequest = Routing.planTrip(directions.origin,
                                           directions.destination,
                                           date,
                                           otpOptions,
                                           true);


        planTripRequest.then(function (itineraries) {
            // Add the itineraries to the map, highlighting the first one
            var isFirst = true;
            itineraryControl.clearItineraries();
            _.forEach(itineraries, function (itinerary) {
                itineraryControl.plotItinerary(itinerary, isFirst);
                itinerary.highlight(isFirst);
                if (isFirst) {
                    currentItinerary = itinerary;
                    isFirst = false;
                }
            });
            currentItinerary.geojson.bringToFront();

            // If there is only one itinerary, make it draggable.
            // Only one itinerary is returned if there are waypoints, so this
            // lets the user to continue to add or modify waypoints without
            // having to select it in the list.
            if (itineraries.length === 1 && !UserPreferences.getPreference('arriveBy')) {
                if (currentItinerary.tourMode) {
                    itineraryControl.tourItinerary(currentItinerary, tour.destinations);
                } else {
                    itineraryControl.draggableItinerary(currentItinerary);
                }
            }

            // snap start and end points to where first itinerary starts and ends
            // (in case one or both markers is someplace unroutable, like in a river)
            directions.origin = [currentItinerary.from.lat, currentItinerary.from.lon];
            directions.destination = [currentItinerary.to.lat, currentItinerary.to.lon];
            updateLocationPreferenceWithDirections('origin');
            updateLocationPreferenceWithDirections('destination');
            // put markers at start and end
            mapControl.setDirectionsMarkers(directions.origin, directions.destination);
            if (currentItinerary.tourMode) {
                tourListControl.setTourDestinations(tour);
                $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
                tourListControl.show();
            } else {
                itineraryListControl.setItineraries(itineraries);
                $(options.selectors.spinner).addClass(options.selectors.hiddenClass);
                itineraryListControl.show();
                // highlight first itinerary in sidebar as well as on map
                findItineraryBlock(currentItinerary.id)
                    .addClass(options.selectors.selectedClass);
            }
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
        mapControl.isochroneControl.clearDestinations();
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

        // add intermediatePlaces if user edited route
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

    /**
     * Handles hover events to highlight a given tour destination
     */
    function onTourDestinationHover(event, destination) {
        if (destination) {
            mapControl.displayPoint(destination.location.x, destination.location.y);
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
            mapControl.displayPoint(null, null);
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
        if (newOrigin && newOrigin.id.indexOf('tour') > -1) {
            console.warn('cannot have a tour as origin!');
        }
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

        // update the directions for the reverse trip
        planTripOrShowPlaces();
    }

    function onTypeaheadCleared(event, key) {
        // Only clear map when origin cleared in tour mode
        if (key === 'origin' && UserPreferences.getPreference('tourMode')) {
            itineraryControl.clearItineraries();
            mapControl.setDirectionsMarkers(null, null);
            directions[key] = null;
            return;
        }
        clearItineraries();
        directions[key] = null;

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
            exploreControl.showPlacesContent(); // hide spinner
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

        if (origin && origin.location) {
            directions.origin = [origin.location.y, origin.location.x];
        }

        if (destination && destination.location) {
            directions.destination = [destination.location.y, destination.location.x ];
        }

        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            // get nearby places if no destination has been set yet, or get directions
            var tourMode = UserPreferences.getPreference('tourMode');
            // Fetch tour destinations on tour directions page (re)load
            if (tourMode) {
                showSpinner();
                var tourName = UserPreferences.getPreference('destinationText');
                Places.queryPlaces(null, tourName).then(function(data) {
                    tour = null;
                    if (tourMode === 'tour' && data.tours && data.tours.length) {
                        tour = data.tours[0];
                    } else if (tourMode === 'event' && data.events && data.events.length) {
                        tour = data.events[0];
                    }
                    if (tour) {
                        onTypeaheadSelectDone('destination', tour.destinations);
                    } else {
                        console.error('Failed to find destinations for tour ' + tourName);
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

})(_, jQuery, moment, CAC.Control, CAC.Places.Places, CAC.Routing.Plans, CAC.User.Preferences);
