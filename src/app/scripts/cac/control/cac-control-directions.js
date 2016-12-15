/**
 *  View control for the directions form
 *
 */
CAC.Control.Directions = (function (_, $, moment, Control, Geocoder, Routing, Typeahead,
                                    UserPreferences, Utils) {

    'use strict';

    // Number of millis to wait on input changes before sending directions request
    var DIRECTION_THROTTLE_MILLIS = 750;

    var defaults = {
        selectors: {
            itineraryBlock: '.route-summary',

            selectedItineraryClass: 'selected',

            spinner: '.directions-results > .sk-spinner'
        }
    };
    var options = {};

    var currentItinerary = null;

    var directions = {
        origin: null,
        destination: null
    };

    var mapControl = null;
    var itineraryControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsFormControl = null;
    var directionsListControl = null;
    var itineraryListControl = null;

    function DirectionsControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;
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
    }

    DirectionsControl.prototype = {
        clearDirections: clearDirections,
        // setDestination: setDestination,
        setDirections: setDirections,
        setOptions: setOptions,
        setFromUserPreferences: setFromUserPreferences
    };

    /**
     * Set user preferences before planning trip.
     * Throttled to cut down on requests.
     */
    var planTrip = _.throttle(function() {  // jshint ignore:line
        if (!tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            return;
        }
        if (!(directions.origin && directions.destination)) {
            directionsFormControl.setError('origin');
            directionsFormControl.setError('destination');

            updateUrl();  // Still update the URL if they request one-sided directions
            return;
        }

        // show spinner while loading
        showSpinner();

        var mode = UserPreferences.getPreference('mode');
        var arriveBy = UserPreferences.getPreference('arriveBy');

        // options to pass to OTP as-is
        var otpOptions = {
            mode: mode,
            arriveBy: arriveBy,
            maxWalkDistance: UserPreferences.getPreference('maxWalk')
        };

        if (mode.indexOf('BICYCLE') > -1) {
            // set bike trip optimization option
            var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
            bikeTriangle = Utils.getBikeTriangle(bikeTriangle);
            if (bikeTriangle) {
                $.extend(otpOptions, {optimize: 'TRIANGLE'}, bikeTriangle);
            }
        } else {
            $.extend(otpOptions, { wheelchair: UserPreferences.getPreference('wheelchair') });
        }

        // add intermediatePlaces if user edited route
        var waypoints = UserPreferences.getPreference('waypoints');
        if (waypoints && waypoints.length && !arriveBy) {
            otpOptions.waypoints = waypoints;
        }

        var params = $.extend({
            fromText: UserPreferences.getPreference('originText'),
            toText: UserPreferences.getPreference('destinationText')
        }, otpOptions);

        var date = UserPreferences.getPreference('dateTime');
        date = date ? moment.unix(date) : moment(); // default to now

        // set user preferences
        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);

        // Most changes trigger this function, so doing this here keeps the URL mostly in sync
        updateUrl();

        tabControl.setTab(tabControl.TABS.DIRECTIONS);

        Routing.planTrip(directions.origin, directions.destination, date, params)
        .then(function (itineraries) {
            $(options.selectors.spinner).addClass('hidden');
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
            if (itineraries.length === 1 && !arriveBy) {
                itineraryControl.draggableItinerary(currentItinerary);
            }

            // put markers at start and end
            mapControl.setDirectionsMarkers(directions.origin, directions.destination);
            itineraryListControl.setItineraries(itineraries);
            itineraryListControl.show();
            // highlight first itinerary in sidebar as well as on map
            findItineraryBlock(currentItinerary.id).addClass(options.selectors.selectedItineraryClass);
        }, function (error) {
            console.error('failed to plan trip');
            console.error(error);
            $(options.selectors.spinner).addClass('hidden');
            itineraryControl.clearItineraries();
            itineraryListControl.setItinerariesError(error);
            itineraryListControl.show();
        });
    }, DIRECTION_THROTTLE_MILLIS);

    return DirectionsControl;

    function onTabShown(event, tabId) {
        if (tabId === tabControl.TABS.DIRECTIONS) {
            UserPreferences.setPreference('method', 'directions');
            setFromUserPreferences();
        } else {
            clearDirections();
        }
    }

    function clearDirections() {
        mapControl.setDirectionsMarkers(null, null);
        urlRouter.clearUrl();
        clearItineraries();
    }

    function clearItineraries() {
        UserPreferences.setPreference('waypoints', undefined);
        itineraryControl.clearItineraries();
        itineraryListControl.hide();
        directionsListControl.hide();
    }

    function showSpinner() {
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.spinner).removeClass('hidden');
    }

    function onDirectionsBackClicked() {
        // show the other itineraries again
        itineraryListControl.showItineraries(true);
        currentItinerary.highlight(true);
        directionsListControl.hide();
        itineraryListControl.show();
    }

    /**
     * Handles click events to select a given itinerary
     */
    function onItineraryClicked(event, itinerary) {
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
            directionsListControl.show();
        }
    }

    function findItineraryBlock(id) {
        return $(options.selectors.itineraryBlock + '[data-itinerary="' + id + '"]');
    }

    /**
     * Handles hover events to highlight a given itinerary
     */
    function onItineraryHover(event, itinerary) {
        if (itinerary) {
            findItineraryBlock(currentItinerary.id)
                .removeClass(options.selectors.selectedItineraryClass);
            findItineraryBlock(itinerary.id).addClass(options.selectors.selectedItineraryClass);
            currentItinerary.highlight(false);
            itinerary.highlight(true);
            currentItinerary = itinerary;
            itinerary.geojson.bringToFront();
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
        planTrip();
    }

    // trigger re-query when trip options update
    function setOptions() {
        planTrip();
    }

    function reverseOriginDestination(event, newOrigin, newDestination) {
        // set on this object and validate
        setDirections('origin', [newOrigin.location.y, newOrigin.location.x]);
        setDirections('destination', [newDestination.location.y, newDestination.location.x]);

        // update the directions for the reverse trip
        planTrip();
    }

    function onTypeaheadCleared(event, key) {
        clearItineraries();
        directions[key] = null;

        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            mapControl.clearDirectionsMarker(key);
        }
    }

    function onTypeaheadSelected(event, key, result) {
        if (!result) {
            setDirections(key, null);
            return;
        }
        setDirections(key, [result.location.y, result.location.x]);
        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            planTrip();
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
        setDirections(key, null);
        $(options.selectors.spinner).addClass('hidden');
        itineraryListControl.setItinerariesError({
            msg: 'Could not find street address for location.'
        });
        if (tabControl.isTabShowing(tabControl.TABS.DIRECTIONS)) {
            itineraryListControl.show();
        }
    }

    // TODO: restore/reimplement this functionality
    /* Show directions to a destination when the user clicks a Places link */
    // function setDestination(destination) {
    //     // Set origin
    //     var origin = UserPreferences.getPreference('origin');
    //     var originText = UserPreferences.getPreference('originText');
    //     directions.origin = [origin.location.y, origin.location.x];

    //     // Set destination
    //     var destinationCoords = destination.point.coordinates;
    //     var destinationText = destination.address;
    //     directions.destination = [destinationCoords[1], destinationCoords[0]];

    //     // Save destination coordinates in expected format (to match typeahead results)
    //     destination.location = {
    //         x: destinationCoords[0],
    //         y: destinationCoords[1]
    //     };

    //     // set in UI
    //     typeaheadFrom.setValue(originText);
    //     typeaheadTo.setValue(destinationText);

    //     // Get directions
    //     planTrip();
    // }

    function setDirections(key, value) {
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

    // Updates the URL to match the currently-selected options
    function updateUrl() {
        urlRouter.updateUrl(urlRouter.buildDirectionsUrlFromPrefs());
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

        if (origin && destination) {
            planTrip();
        }
    }

})(_, jQuery, moment, CAC.Control, CAC.Search.Geocoder,
    CAC.Routing.Plans, CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
