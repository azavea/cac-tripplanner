/**
 *  View control for the sidebar directions tab
 *
 */
CAC.Control.SidebarDirections = (function (_, $, Control, BikeModeOptions, Geocoder,
                                 Routing, Typeahead, UserPreferences, Utils) {

    'use strict';

    var METERS_PER_MILE = 1609.34;

    // Number of millis to wait on input changes before sending directions request
    var DIRECTION_THROTTLE_MILLIS = 750;

    // default maxWalk when biking (in miles)
    var MAXWALK_BIKE = 300;

    var defaults = {
        selectors: {
            bikeTriangleDiv: '#directionsBikeTriangle',
            datepicker: '#datetimeDirections',
            departAtSelect: '#directionsDepartAt',
            destination: 'section.directions input.destination',
            directions: '.directions',
            directionInput: '.direction-input',
            errorClass: 'error',
            itineraryBlock: '.block-itinerary',
            itineraryList: 'section.directions .itineraries',
            maxWalkDiv: '#directionsMaxWalk',
            modeSelectors: '#directionsModes input',
            origin: 'section.directions input.origin',
            resultsClass: 'show-results',
            reverseButton: '#reverse',
            spinner: 'section.directions div.sidebar-details > .sk-spinner',
            wheelchairDiv: '#directionsWheelchair',

            // Use separate typeahead selectors for dest/origin so we they aren't
            // treated as a single entity (e.g. so clearing doesn't clear both).
            typeaheadDest: 'section.directions input.typeahead.destination',
            typeaheadOrigin: 'section.directions input.typeahead.origin'
        }
    };
    var options = {};

    var currentItinerary = null;
    var datepicker = null;

    var directions = {
        origin: null,
        destination: null
    };

    var bikeModeOptions = null;
    var mapControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsListControl = null;
    var itineraryListControl = null;
    var typeaheadDest = null;
    var typeaheadOrigin = null;

    function SidebarDirectionsControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;
        urlRouter = options.urlRouter;
        bikeModeOptions = new BikeModeOptions();

        $(options.selectors.modeSelectors).change($.proxy(changeMode, this));

        $(options.selectors.reverseButton).click($.proxy(reverseOriginDestination, this));

        // initiallize date/time picker
        datepicker = $(options.selectors.datepicker).datetimepicker({useCurrent: true});
        datepicker.on('dp.change', planTrip);

        directionsListControl = new Control.DirectionsList({
            showBackButton: true,
            showShareButton: true,
            selectors: {
                container: 'section.directions .directions-list',
                directionItem: '.direction-item',
                backButton: 'a.back',
                shareButton: 'a.share'
            }
        });
        directionsListControl.events.on(directionsListControl.eventNames.backButtonClicked,
                                        onDirectionsBackClicked);

        itineraryListControl = new Control.ItineraryList({
            selectors: {
                container: 'section.directions .itineraries'
            }
        });
        itineraryListControl.events.on(itineraryListControl.eventNames.itineraryClicked,
                                       onItineraryClicked);
        itineraryListControl.events.on(itineraryListControl.eventNames.itineraryHover,
                                       onItineraryHover);

        mapControl.events.on(mapControl.eventNames.waypointsSet, queryWithWaypoints);

        typeaheadDest = new Typeahead(options.selectors.typeaheadDest);
        typeaheadDest.events.on(typeaheadDest.eventNames.selected, onTypeaheadSelected);
        typeaheadDest.events.on(typeaheadDest.eventNames.cleared, onTypeaheadCleared);

        typeaheadOrigin = new Typeahead(options.selectors.typeaheadOrigin);
        typeaheadOrigin.events.on(typeaheadOrigin.eventNames.selected, onTypeaheadSelected);
        typeaheadOrigin.events.on(typeaheadOrigin.eventNames.cleared, onTypeaheadCleared);

        // Listen to direction hovered events in order to show a point on the map
        directionsListControl.events.on(
            directionsListControl.eventNames.directionHovered,
            function(e, lon, lat) {
                mapControl.displayPoint(lon, lat);
            });

        if (tabControl.isTabShowing('directions')) {
            setFromUserPreferences();
        }

        // Respond to changes on all direction input fields
        $(options.selectors.directionInput).on('input change', planTrip);
    }

    SidebarDirectionsControl.prototype = {
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
        if (!tabControl.isTabShowing('directions')) {
            return;
        }

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

        var picker = $(options.selectors.datepicker).data('DateTimePicker');
        // use current date/time if none set
        var date = picker.date() || moment();

        var mode = bikeModeOptions.getMode(options.selectors.modeSelectors);
        var arriveBy = false; // depart at time by default
        if ($(options.selectors.departAtSelect).val() === 'arriveBy') {
            arriveBy = true;
        }

        // options to pass to OTP as-is
        var otpOptions = {
            mode: mode,
            arriveBy: arriveBy
        };

        // add intermediatePlaces if user edited route
        var waypoints = UserPreferences.getPreference('waypoints');
        if (waypoints && waypoints.length) {
            otpOptions.waypoints = waypoints;
        }

        if (mode.indexOf('BICYCLE') > -1) {
            var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
            var bikeTriangle = bikeTriangleOpt.val();
            $.extend(otpOptions, {optimize: 'TRIANGLE'},
                     bikeModeOptions.options.bikeTriangle[bikeTriangle]);
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

        // Most changes trigger this function, so doing this here keeps the URL mostly in sync
        updateUrl();

        var params = {
            fromText: UserPreferences.getPreference('originText'),
            toText: UserPreferences.getPreference('destinationText')
        };
        $.extend(params, otpOptions);

        Routing.planTrip(directions.origin, directions.destination, date, params)
        .then(function (itineraries) {
            $(options.selectors.spinner).addClass('hidden');
            if (!tabControl.isTabShowing('directions')) {
                // if user has switched away from the directions tab, do not show trip
                return;
            }
            // Add the itineraries to the map, highlighting the first one
            var isFirst = true;
            mapControl.clearItineraries();
            _.forIn(itineraries, function (itinerary) {
                mapControl.plotItinerary(itinerary, isFirst);
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
            if (itineraries.length === 1) {
                mapControl.draggableItinerary(currentItinerary);
            }

            // put markers at start and end
            mapControl.setDirectionsMarkers(directions.origin, directions.destination);
            itineraryListControl.setItineraries(itineraries);
            $(options.selectors.directions).addClass(options.selectors.resultsClass);
            itineraryListControl.show();
        }, function (error) {
            $(options.selectors.spinner).addClass('hidden');
            mapControl.clearItineraries();
            itineraryListControl.setItinerariesError(error);
            $(options.selectors.directions).addClass(options.selectors.resultsClass);
            itineraryListControl.show();
        });
    }, DIRECTION_THROTTLE_MILLIS);

    return SidebarDirectionsControl;

    function changeMode() {
        bikeModeOptions.changeMode(options.selectors);
        planTrip();
    }

    function clearDirections() {
        mapControl.setDirectionsMarkers(null, null);
        urlRouter.clearUrl();
        clearItineraries();
    }

    function clearItineraries() {
        UserPreferences.setPreference('waypoints', undefined);
        mapControl.clearItineraries();
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
            mapControl.draggableItinerary(itinerary);
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
            findItineraryBlock(currentItinerary.id).css('background-color', 'white');
            findItineraryBlock(itinerary.id).css('background-color', 'lightgray');
            currentItinerary.highlight(false);
            itinerary.highlight(true);
            currentItinerary = itinerary;
        }
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
        typeaheadOrigin.setValue(destinationText);
        typeaheadDest.setValue(originText);

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
        var typeahead = (key === 'origin') ? typeaheadOrigin : typeaheadDest;

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
        bikeModeOptions.setMode(options.selectors.modeSelectors, mode);
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        typeaheadOrigin.setValue(originText);
        typeaheadDest.setValue(destinationText);
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

        bikeModeOptions.setMode(options.selectors.modeSelectors, mode);

        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        if (arriveBy) {
            $(options.selectors.departAtSelect).val('arriveBy');
        }

        if (destination && destination.feature && destination.feature.geometry) {
            directions.destination = [
                destination.feature.geometry.y,
                destination.feature.geometry.x
            ];
            typeaheadDest.setValue(destinationText);
        }

        if (origin && origin.feature && origin.feature.geometry) {
            directions.origin = [origin.feature.geometry.y, origin.feature.geometry.x];
            typeaheadOrigin.setValue(originText);
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

})(_, jQuery, CAC.Control, CAC.Control.BikeModeOptions, CAC.Search.Geocoder,
    CAC.Routing.Plans, CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
