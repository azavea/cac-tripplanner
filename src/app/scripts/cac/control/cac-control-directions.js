/**
 *  View control for the directions form
 *
 */
CAC.Control.Directions = (function (_, $, Control, ModeOptions, Geocoder, Routing, Typeahead,
                                    UserPreferences, Utils) {

    'use strict';

    var METERS_PER_MILE = 1609.34;

    // Number of millis to wait on input changes before sending directions request
    var DIRECTION_THROTTLE_MILLIS = 750;

    // default maxWalk when biking (in miles)
    var MAXWALK_BIKE = 300;

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

            // top-level classes
            homePageClass: 'body-home',
            mapPageClasses: 'body-map body-has-sidebar-banner',

            itineraryBlock: '.route-summary',

            // TODO: update or remove below components (from before refactor)
            bikeTriangleDiv: '#directionsBikeTriangle',
            datepicker: '#datetimeDirections',
            departAtSelect: '#directionsDepartAt',
            destination: 'section.directions input.destination',
            directions: '.directions',
            directionInput: '.direction-input',
            errorClass: 'error',
            maxWalkDiv: '#directionsMaxWalk',
            resultsClass: 'show-results',
            spinner: 'section.directions div.sidebar-details > .sk-spinner',
            wheelchairDiv: '#directionsWheelchair',
        }
    };
    var options = {};

    var currentItinerary = null;
    //var datepicker = null; // TODO: build new datepicker controls

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

        $(options.selectors.modes).change($.proxy(changeMode, this));

        $(options.selectors.reverseButton).click($.proxy(reverseOriginDestination, this));

        // TODO: updated time/date control
        // initiallize date/time picker
        //datepicker = $(options.selectors.datepicker).datetimepicker({useCurrent: true});
        //datepicker.on('dp.change', planTrip);

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

        // Respond to changes on all direction input fields
        $(options.selectors.directionInput).on('input change', planTrip);
    }

    DirectionsControl.prototype = {
        clearDirections: clearDirections,
        moveOriginDestination: moveOriginDestination,
        setDestination: setDestination,
        setDirections: setDirections,
        setFromUserPreferences: setFromUserPreferences
    };

    /**
     * Set user preferences before planning trip.
     * Throttled to cut down on requests.
     */
    var planTrip = _.throttle(function() {  // jshint ignore:line
        if (!(directions.origin && directions.destination)) {
            setDirectionsError('origin');
            setDirectionsError('input-directions-to');

            // TODO: fix URL routing for redesign
            //updateUrl();  // Still update the URL if they request one-sided directions
            return;
        }

        // show spinner while loading
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.spinner).removeClass('hidden');

        // TODO: updated date/time control
        //var picker = $(options.selectors.datepicker).data('DateTimePicker');
        // use current date/time if none set
        //var date = picker.date() || moment();
        var date = moment();

        var mode = modeOptionsControl.getMode();
        var arriveBy = isArriveBy(); // depart at time by default

        // options to pass to OTP as-is
        var otpOptions = {
            mode: mode,
            arriveBy: arriveBy
        };

        // add intermediatePlaces if user edited route
        var waypoints = UserPreferences.getPreference('waypoints');
        if (waypoints && waypoints.length && !arriveBy) {
            otpOptions.waypoints = waypoints;
        }

        if (mode.indexOf('BICYCLE') > -1) {
            var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
            var bikeTriangle = bikeTriangleOpt.val();
            $.extend(otpOptions, {optimize: 'TRIANGLE'},
                     modeOptionsControl.options.bikeTriangle[bikeTriangle]);
            UserPreferences.setPreference('bikeTriangle', bikeTriangle);

            // allow longer bike riding when using public transit
            $.extend(otpOptions, { maxWalkDistance: MAXWALK_BIKE * METERS_PER_MILE });
        } else {
            var maxWalk = $('input', options.selectors.maxWalkDiv).val();
            if (maxWalk) {
                UserPreferences.setPreference('maxWalk', maxWalk);
                $.extend(otpOptions, { maxWalkDistance: maxWalk * METERS_PER_MILE });
            } else {
                UserPreferences.setPreference('maxWalk', undefined);
            }

            // true if box checked
            var wheelchair = $('input', options.selectors.wheelchairDiv).prop('checked');
            UserPreferences.setPreference('wheelchair', wheelchair);
            $.extend(otpOptions, { wheelchair: wheelchair });
        }

        // set user preferences
        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('arriveBy', arriveBy);

        // TODO: fix URL handling for redesign
        // Most changes trigger this function, so doing this here keeps the URL mostly in sync
        //updateUrl();

        var params = {
            fromText: UserPreferences.getPreference('originText'),
            toText: UserPreferences.getPreference('destinationText')
        };
        $.extend(params, otpOptions);

        // change to map view, if not there already
        var $homepage = $('.' + options.selectors.homePageClass);
        if ($homepage) {
            $homepage.blur()
                     .removeClass(options.selectors.homePageClass)
                     .addClass(options.selectors.mapPageClasses);
        }

        mapControl.goToMapPage();

        Routing.planTrip(directions.origin, directions.destination, date, params)
        .then(function (itineraries) {
            $(options.selectors.spinner).addClass('hidden');
            if (!tabControl.isTabShowing('directions')) {
                // if user has switched away from the directions tab, do not show trip
                return;
            }
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
            if (itineraries.length === 1 && !isArriveBy()) {
                itineraryControl.draggableItinerary(currentItinerary);
            }

            // put markers at start and end
            mapControl.setDirectionsMarkers(directions.origin, directions.destination);
            itineraryListControl.setItineraries(itineraries);
            $(options.selectors.directions).addClass(options.selectors.resultsClass);
            itineraryListControl.show();
        }, function (error) {
            console.error('failed to plan trip');
            console.error(error);
            $(options.selectors.spinner).addClass('hidden');
            itineraryControl.clearItineraries();
            itineraryListControl.setItinerariesError(error);
            $(options.selectors.directions).addClass(options.selectors.resultsClass);
            itineraryListControl.show();
        });
    }, DIRECTION_THROTTLE_MILLIS);

    return DirectionsControl;

    function changeMode() {
        modeOptionsControl.changeMode();
        planTrip();
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
        $(options.selectors.directions).removeClass(options.selectors.resultsClass);
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

            if (!isArriveBy()) {
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
     * Helper to check if user has selected to route by arrive-by time
     * rather than default depart-at time.
     *
     * @returns boolean True if user has selected arrive-by
     */
    function isArriveBy() {
        if ($(options.selectors.departAtSelect).val() === 'arriveBy') {
            return true;
        }
        return false;
    }

    /**
     * Handles hover events to highlight a given itinerary
     */
    function onItineraryHover(event, itinerary) {
        if (itinerary) {
            findItineraryBlock(currentItinerary.id).css('background-color', 'white');
            findItineraryBlock(itinerary.id).css('background-color', 'lightgray');
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

    function reverseOriginDestination() {
        // read what they are now
        var origin = UserPreferences.getPreference('origin');
        var originText = UserPreferences.getPreference('originText');
        var destination = UserPreferences.getPreference('destination');
        var destinationText = UserPreferences.getPreference('destinationText');

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

        var $input;
        var prefKey;

        // Make sure to keep the directionsFrom origin in sync with the explore origin
        if (key === 'origin') {
            prefKey = 'origin';
            $input = $(options.selectors.directionsFrom);
        } else if (key === 'destination') {
            prefKey = 'destination';
            $input = $(options.selectors.typeaheadTo);
        } else {
            console.error('unrecognized typeahead key ' + key);
            return;
        }


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
                $(options.selectors.directions).addClass(options.selectors.resultsClass);
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
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        typeaheadFrom.setValue(originText);
        typeaheadTo.setValue(destinationText);
        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        // Save selections to user preferences
        UserPreferences.setLocation('destination', destination, destinationText);

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
     * When first navigating to this page, check for user preferences to load.
     */
    function setFromUserPreferences() {
        // Look up origin with setDefault=false to allow it to be blank
        var origin = UserPreferences.getPreference('origin', false);
        var originText = UserPreferences.getPreference('originText', false);
        var destination = UserPreferences.getPreference('destination');
        var destinationText = UserPreferences.getPreference('destinationText');
        var mode = UserPreferences.getPreference('mode');
        var arriveBy = UserPreferences.getPreference('arriveBy');
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        var maxWalk = UserPreferences.getPreference('maxWalk');
        var wheelchair = UserPreferences.getPreference('wheelchair');

        if (wheelchair) {
            $('input', options.selectors.wheelchairDiv).click();
        }

        if (maxWalk) {
            $('input', options.selectors.maxWalkDiv).val(maxWalk);
        }

        modeOptionsControl.setMode(mode);

        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        if (arriveBy) {
            $(options.selectors.departAtSelect).val('arriveBy');
        }

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

        if (tabControl.isTabShowing('directions')) {
            if (origin && destination) {
                planTrip();
            } else if (origin || destination) {
                mapControl.setDirectionsMarkers(directions.origin, directions.destination, true);
                clearItineraries();
            } else {
                clearDirections();
            }
        }
    }

})(_, jQuery, CAC.Control, CAC.Control.ModeOptions, CAC.Search.Geocoder,
    CAC.Routing.Plans, CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
