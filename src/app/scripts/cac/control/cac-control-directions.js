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
            // origin/destination switcher
            reverseButton: '.btn-reverse',

            // directions form selectors
            directionsForm: '.directions-form-element',
            directionsFrom: '.directions-from',
            directionsTo: '.directions-to',

            // typeahead
            typeaheadFrom: '#input-directions-from',
            typeaheadTo: '#input-directions-to',

            itineraryBlock: '.route-summary',

            // used for error display
            origin: '.directions-from.directions-text-input',
            destination: '.directions-to.directions-text-input',

            selectedItineraryClass: 'selected',
            errorClass: 'error',

            // TODO: add back spinner components (from before refactor)
            spinner: '.directions-results > .sk-spinner',
        }
    };
    var options = {};

    var currentItinerary = null;

    var directions = {
        origin: null,
        destination: null
    };

    var modeOptionsControl = null;
    var mapControl = null;
    var itineraryControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsListControl = null;
    var itineraryListControl = null;
    var typeaheadTo = null;
    var typeaheadFrom = null;

    function DirectionsControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;
        itineraryControl = mapControl.itineraryControl;
        urlRouter = options.urlRouter;
        modeOptionsControl = options.modeOptionsControl;
        modeOptionsControl.events.on(modeOptionsControl.eventNames.toggle, planTrip);
        modeOptionsControl.events.on(modeOptionsControl.eventNames.transitChanged, planTrip);

        $(options.selectors.reverseButton).click($.proxy(reverseOriginDestination, this));

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

        typeaheadTo = new Typeahead(options.selectors.typeaheadTo);
        typeaheadTo.events.on(typeaheadTo.eventNames.selected, onTypeaheadSelected);
        typeaheadTo.events.on(typeaheadTo.eventNames.cleared, onTypeaheadCleared);

        typeaheadFrom = new Typeahead(options.selectors.typeaheadFrom);
        typeaheadFrom.events.on(typeaheadFrom.eventNames.selected, onTypeaheadSelected);
        typeaheadFrom.events.on(typeaheadFrom.eventNames.cleared, onTypeaheadCleared);

        // Listen to direction hovered events in order to show a point on the map
        directionsListControl.events.on(
            directionsListControl.eventNames.directionHovered,
            function(e, lon, lat) {
                mapControl.displayPoint(lon, lat);
        });
    }

    DirectionsControl.prototype = {
        clearDirections: clearDirections,
        moveOriginDestination: moveOriginDestination,
        setDestination: setDestination,
        setDirections: setDirections,
        setOptions: setOptions,
        setFromUserPreferences: setFromUserPreferences
    };

    /**
     * Set user preferences before planning trip.
     * Throttled to cut down on requests.
     */
    var planTrip = _.throttle(function() {  // jshint ignore:line
        if (!(directions.origin && directions.destination)) {
            setDirectionsError('origin');
            setDirectionsError('destination');

            updateUrl();  // Still update the URL if they request one-sided directions
            return;
        }

        // show spinner while loading
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.spinner).removeClass('hidden');

        var date = UserPreferences.getPreference('dateTime');
        date = date ? moment.unix(date) : moment(); // default to now

        var mode = modeOptionsControl.getMode();
        var arriveBy = UserPreferences.getPreference('arriveBy');

        // options to pass to OTP as-is
        var otpOptions = {
            arriveBy: arriveBy,
            maxWalkDistance: UserPreferences.getPreference('maxWalk')
        };

        // add intermediatePlaces if user edited route
        var waypoints = UserPreferences.getPreference('waypoints');
        if (waypoints && waypoints.length && !arriveBy) {
            otpOptions.waypoints = waypoints;
        }

        if (mode.indexOf('BICYCLE') > -1) {
            // set bike trip optimization option
            var bikeTriangle = UserPreferences.getPreference('bikeTriangle');

            if (_.has(modeOptionsControl.options.bikeTriangle, bikeTriangle)) {
                $.extend(otpOptions, {optimize: 'TRIANGLE'},
                     modeOptionsControl.options.bikeTriangle[bikeTriangle]);
            } else {
                console.error('unrecognized bike triangle option ' + bikeTriangle);
            }

            // check user preference for bike share here, and update query mode if so
            if (UserPreferences.getPreference('bikeShare')) {
                mode = mode.replace('BICYCLE', 'BICYCLE_RENT');
            }

        } else {
            $.extend(otpOptions, { wheelchair: UserPreferences.getPreference('wheelchair') });
        }

        $.extend(otpOptions, {mode: mode});

        // set user preferences
        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);

        // Most changes trigger this function, so doing this here keeps the URL mostly in sync
        updateUrl();

        var params = {
            fromText: UserPreferences.getPreference('originText'),
            toText: UserPreferences.getPreference('destinationText')
        };
        $.extend(params, otpOptions);

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

    function reverseOriginDestination() {
        // read what they are now
        var origin = UserPreferences.getPreference('origin');
        var originText = UserPreferences.getPreference('originText');
        var destination = UserPreferences.getPreference('destination');
        var destinationText = UserPreferences.getPreference('destinationText');

        if (!(directions.origin && directions.destination)) {
            setDirectionsError('origin');
            setDirectionsError('destination');
            return;
        }

        // update local storage
        UserPreferences.setPreference('origin', destination);
        UserPreferences.setPreference('originText', destinationText);
        UserPreferences.setPreference('destination', origin);
        UserPreferences.setPreference('destinationText', originText);

        // update the text control
        typeaheadFrom.setValue(destinationText);
        typeaheadTo.setValue(originText);

        // set on this object and validate
        setDirections('origin', [destination.feature.geometry.y, destination.feature.geometry.x]);
        setDirections('destination', [origin.feature.geometry.y, origin.feature.geometry.x]);

        // update the directions for the reverse trip
        planTrip();
    }

    function onTypeaheadCleared(event, key) {
        clearItineraries();
        directions[key] = null;
        UserPreferences.clearLocation(key);
        mapControl.clearDirectionsMarker(key);
        // hide reverse origin/destination button
        $(options.selectors.reverseButton).css('visibility', 'hidden');
    }

    function onTypeaheadSelected(event, key, location) {

        event.preventDefault();  // do not submit form

        if (!location) {
            UserPreferences.clearLocation(key);
            setDirections(key, null);
            return;
        }

        // show reverse origin/destination button
        $(options.selectors.reverseButton).css('visibility', 'visible');

        // save text for address to preferences
        UserPreferences.setLocation(key, location);
        setDirections(key, [location.feature.geometry.y, location.feature.geometry.x]);

        planTrip();
    }

    /**
     * Change the origin or destination, then requery for directions.
     *
     * @param {String} key Either 'origin' or 'destination'
     * @param {Object} position Has coordinates for new spot as 'lat' and 'lng' properties
     */
    function moveOriginDestination(key, position) {
        if (key !== 'origin' && key !== 'destination') {
            console.error('Unrecognized key in moveOriginDestination: ' + key);
            return;
        }
        var typeahead = (key === 'origin') ? typeaheadFrom : typeaheadTo;

        // show spinner while loading
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.spinner).removeClass('hidden');

        Geocoder.reverse(position.lat, position.lng).then(function (data) {
            if (data && data.address) {
                // prevent typeahead dropdown from opening by removing focus
                $(options.selectors.typeaheadFrom).blur();
                $(options.selectors.typeaheadTo).blur();

                var location = Utils.convertReverseGeocodeToFeature(data);
                UserPreferences.setPreference(key, location);
                /*jshint camelcase: false */
                var fullAddress = data.address.Match_addr;
                /*jshint camelcase: true */
                UserPreferences.setPreference(key + 'Text', fullAddress);
                // The change event is triggered after setting the typeahead value
                // in order to run the navigation icon hide/show logic
                typeahead.setValue(fullAddress);
                setDirections(key, [position.lat, position.lng]);
                planTrip();
            } else {
                // unset location and show error
                UserPreferences.clearLocation(key);
                typeahead.setValue('');
                setDirections(key, null);
                $(options.selectors.spinner).addClass('hidden');
                itineraryListControl.setItinerariesError({
                    msg: 'Could not find street address for location.'
                });
                itineraryListControl.show();
            }
        });
    }

    // called when going to show directions from 'explore' origin to a selected feature
    function setDestination(destination) {
        // Set origin
        var origin = UserPreferences.getPreference('origin');
        var originText = UserPreferences.getPreference('originText');
        directions.origin = [origin.feature.geometry.y, origin.feature.geometry.x];

        // Set destination
        var destinationCoords = destination.point.coordinates;
        var destinationText = destination.address;
        directions.destination = [destinationCoords[1], destinationCoords[0]];

        // Save destination coordinates in expected format (to match typeahead results)
        destination.feature = {
            geometry: {
                x: destinationCoords[0],
                y: destinationCoords[1]
            }
        };

        // set in UI
        var mode = UserPreferences.getPreference('mode');
        modeOptionsControl.setMode(mode);
        typeaheadFrom.setValue(originText);
        typeaheadTo.setValue(destinationText);

        // Get directions
        planTrip();
    }

    function setDirections(key, value) {
        clearItineraries();
        if (key === 'origin' || key === 'destination') {
            directions[key] = value;
            setDirectionsError(key);
        } else {
            console.error('Directions key ' + key + 'unrecognized!');
        }
    }

    function setDirectionsError(key) {
        var $input = null;
        if (key === 'origin') {
            $input = $(options.selectors.origin);
        } else {
            $input = $(options.selectors.destination);
        }

        if (directions[key]) {
            $input.removeClass(options.selectors.errorClass);
        } else {
            $input.addClass(options.selectors.errorClass);
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
        var originText = UserPreferences.getPreference('originText');
        var destination = UserPreferences.getPreference('destination');
        var destinationText = UserPreferences.getPreference('destinationText');

        if (destination && destination.feature && destination.feature.geometry) {
            directions.destination = [
                destination.feature.geometry.y,
                destination.feature.geometry.x
            ];
            typeaheadTo.setValue(destinationText);
        }

        if (origin && origin.feature && origin.feature.geometry) {
            directions.origin = [origin.feature.geometry.y, origin.feature.geometry.x];
            typeaheadFrom.setValue(originText);
        }

        if (origin && destination) {
            planTrip();
        }
    }

})(_, jQuery, moment, CAC.Control, CAC.Search.Geocoder,
    CAC.Routing.Plans, CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
