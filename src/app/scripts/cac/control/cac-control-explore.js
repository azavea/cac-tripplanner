/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.Explore = (function (_, $, ModeOptions, Geocoder, MapTemplates, Routing,
                              Typeahead, UserPreferences) {

    'use strict';

    // Number of millis to wait on input changes before sending isochrone request
    var ISOCHRONE_DEBOUNCE_MILLIS = 750;

    var defaults = {
        selectors: {
            // datepicker: '#datetimeExplore',
            // distanceMinutesText: '.distance-minutes',

            placesList: '.places-content',
            spinner: '.places > .sk-spinner',
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        destinationDirections: 'cac:control:explore:destinationdirections'
    };

    var modeOptionsControl = null;
    // var datepicker = null;
    var mapControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsFormControl = null;
    var exploreLatLng = null;
    // var selectedPlaceId = null;
    // var destinationsCache = [];

    function ExploreControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;
        urlRouter = options.urlRouter;
        directionsFormControl = options.directionsFormControl;
        modeOptionsControl = options.modeOptionsControl;

        modeOptionsControl.events.on(modeOptionsControl.eventNames.toggle, clickedExplore);
        modeOptionsControl.events.on(modeOptionsControl.eventNames.transitChanged, clickedExplore);

        mapControl.events.on(mapControl.eventNames.originMoved, onMovePointStart);

        tabControl.events.on(tabControl.eventNames.tabShown, onTabShown);

        // $(options.selectors.optionsViewMore).click(showOptions);

        directionsFormControl.events.on(directionsFormControl.eventNames.selected,
                                        onTypeaheadSelected);
        directionsFormControl.events.on(directionsFormControl.eventNames.cleared,
                                        onTypeaheadCleared);
        directionsFormControl.events.on(directionsFormControl.eventNames.geocodeError,
                                        onGeocodeError);

        if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            setFromUserPreferences();
        }

        // TODO: respond to options changes
    }

    ExploreControl.prototype = {
        events: events,
        eventNames: eventNames,
        setAddress: setAddress,
        // setDestinationSidebar: setDestinationSidebar,
        setFromUserPreferences: setFromUserPreferences
    };

    // When the explore tab is activated, do the thing. If some other tab is activated, clear the
    // isochrone and destination markers.
    function onTabShown(event, tabId) {
        if (tabId === tabControl.TABS.EXPLORE) {
            UserPreferences.setPreference('method', 'explore');
            setFromUserPreferences();
        } else {
            mapControl.isochroneControl.clearIsochrone();
            mapControl.isochroneControl.clearDestinations();
        }
    }

    // If they move the marker, that invalidates the old isochrone and triggers the form to
    // reverse geocode the new location, so show the spinner while that happens.
    function onMovePointStart() {
        if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            $(options.selectors.placesList).addClass('hidden');
            $(options.selectors.spinner).removeClass('hidden');
        }
    }

    // If they dragged the origin or destination and the location failed to geocode, show error.
    // Since the drag event activates the spinner, this needs to restore the sidebar list.
    function onGeocodeError(event, key) {
        if (key === 'origin') {
            setAddress(null);
            setError('Could not find street address for location.');
            $(options.selectors.spinner).addClass('hidden');
            if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
                directionsFormControl.setError('origin');
                $(options.selectors.placesList).removeClass('hidden');
            }
        }
    }

    /**
     * Set user preferences before fetching isochrone.
     * This function has been debounced to cut down on requests.
     */
    var clickedExplore = _.debounce(function() {  // jshint ignore:line
        if (!exploreLatLng) {
            return;
        }

        // var exploreMinutes = $(options.selectors.exploreTime).val();

        // var picker = $(options.selectors.datepicker).data('DateTimePicker');
        // var date = picker.date();
        // if (!date) {
        //     // use current date/time if none set
        //     date = moment();
        // }

        // TODO: fix placeholders
        var date = moment();
        var exploreMinutes = 30;

        var otpOptions = {};

        var mode = modeOptionsControl.getMode();

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

        // store search inputs to preferences
        UserPreferences.setPreference('method', 'explore');
        // UserPreferences.setPreference('exploreTime', exploreMinutes);
        UserPreferences.setPreference('mode', mode);

        fetchIsochrone(date, exploreMinutes, otpOptions);
    }, ISOCHRONE_DEBOUNCE_MILLIS);

    return ExploreControl;

    /**
     * Fetch travelshed from OpenTripPlanner, then populate side bar with featured locations
     * found within the travelshed.
     *
     * @param {Object} when Moment.js time for the search (default to now)
     * @param {String} mode String for travel mode to pass to OTP (walk, transit, etc.)
     * @param {Number} exploreMinutes Number of minutes of travel for the isochrone limit
     */
    function fetchIsochrone(when, exploreMinutes, otpOptions) {
        // Most interactions trigger this function, so updating the URL here keeps it mostly in sync
        // (the 'detail' functions don't update the isochrone so they update the URL themselves)
        updateUrl();

        $(options.selectors.placesList).addClass('hidden');
        $(options.selectors.spinner).removeClass('hidden');

        // do not zoom to fit isochrone if going to highlight a selected destination
        // var zoomToFit = !selectedPlaceId;

        mapControl.isochroneControl.fetchIsochrone(exploreLatLng, when, exploreMinutes, otpOptions,
                                                   true).then(
            function (destinations) {
                $(options.selectors.spinner).addClass('hidden');
                $(options.selectors.placesList).removeClass('hidden');
                if (!destinations) {
                    setError('No destinations found.');
                }
                // setDestinationSidebar(destinations);
            }, function (error) {
                console.error(error);
                $(options.selectors.spinner).addClass('hidden');
                $(options.selectors.placesList).removeClass('hidden');
                setError('Could not find travelshed.');
            }
        );
    }

    function setError(message) {
        console.log('TODO: display isochrone errors', message);
        // var $container = $('<div></div>').addClass('destinations');
        // var $errorTemplate = $(MapTemplates.destinationError({'message': message}));
        // $container.append($errorTemplate);
        // $(options.selectors.destinations).html($container);
        // $(options.selectors.sidebarContainer).height(200);
    }

    function onTypeaheadCleared(event, key) {
        if (key === 'origin') {
            exploreLatLng = null;
            // selectedPlaceId = null;
            mapControl.isochroneControl.clearIsochrone();
        }
    }

    function onTypeaheadSelected(event, key, location) {
        setAddress(location);
        // selectedPlaceId = null;
        if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            clickedExplore();
        }
    }

    /**
     * Set or clear address.
     * If setting, also draw the map marker (if the tab is shown).
     * If clearing, also clear the isochrone.
     */
    function setAddress(address) {
        if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            directionsFormControl.setError('origin');
        }
        if (address) {
            exploreLatLng = [address.location.y, address.location.x];
            if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
                mapControl.setDirectionsMarkers(exploreLatLng);
            }
        } else {
            exploreLatLng = null;
            mapControl.isochroneControl.clearIsochrone();
        }
    }

    /**
     * Query OTP for travel time to a destination, then put it in the side panel.
     *
     * @param {Object} destination Destination put in the sidebar
     */
    // function setDestinationDistance(destination) {

    //     // helper to set the text snippet
    //     function setDestinationMinutesText(distanceMinutes) {
    //         var $destination = $('#destination-' + destination.id);
    //         $destination.find(options.selectors.distanceMinutesText)
    //             .text(distanceMinutes + ' minutes away');
    //     }

    //     // first check if we have distance cached
    //     if (destination.formattedDuration) {
    //         setDestinationMinutesText(destination.formattedDuration);
    //         return;
    //     }

    //     // distance not cached; go query for it
    //     var mode = UserPreferences.getPreference('mode');
    //     var picker = $(options.selectors.datepicker).data('DateTimePicker');
    //     // use current date/time if none set
    //     var date = picker.date() || moment();
    //     // only request one itinerary (first returned is the shortest)
    //     var otpOptions = { mode: mode, numItineraries: 1 };
    //     if (mode.indexOf('BICYCLE') > -1) {
    //         var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
    //         var bikeTriangle = bikeTriangleOpt.val();
    //         $.extend(otpOptions, {optimize: 'TRIANGLE'},
    //                  modeOptionsControl.options.bikeTriangle[bikeTriangle]);
    //     } else {
    //         var maxWalk = $('input', options.selectors.maxWalkDiv).val();
    //         if (maxWalk) {
    //             $.extend(otpOptions, { maxWalkDistance: maxWalk * METERS_PER_MILE });
    //         }
    //         // true if box checked
    //         var wheelchair = $('input', options.selectors.wheelchairDiv).prop('checked');
    //         $.extend(otpOptions, { wheelchair: wheelchair });
    //     }

    //     var dest = [destination.point.coordinates[1], destination.point.coordinates[0]];

    //     Routing.planTrip(exploreLatLng, dest, date, otpOptions).then(function (itineraries) {
    //         if (itineraries.length) {
    //             var distance = itineraries[0].formattedDuration;
    //             destination.formattedDuration = distance;
    //             setDestinationMinutesText(distance);
    //         }
    //     });
    // }

    // function setDestinationSidebar(destinations) {
    //     destinationsCache = destinations;
    //     if (!destinations) {
    //         return;
    //     }
    //     var $container = $('<div></div>').addClass('destinations');
    //     $.each(destinations, function (i, destination) {
    //         var $destination = $(MapTemplates.destinationBlock(destination));
    //         $destination.click(function () {
    //             setDestinationSidebarDetail(destination.id);
    //             mapControl.isochroneControl.highlightDestination(destination.id, { panTo: true });
    //         });
    //         $destination.hover(function () {
    //             mapControl.isochroneControl.highlightDestination(destination.id);
    //         }, function () {
    //             mapControl.isochroneControl.highlightDestination(null);
    //         });
    //         $container.append($destination);
    //     });
    //     $(options.selectors.destinations).html($container);
    //     // go find distances once the sidebar templates have been added to DOM
    //     $.each(destinations, function(i, destination) {
    //         setDestinationDistance(destination);
    //     });
    //     $(options.selectors.sidebarContainer).height(400);

    //     // show destination details if destination is selected
    //     if (selectedPlaceId) {
    //         setDestinationSidebarDetail(selectedPlaceId);
    //         // also highlight it on the map and pan to it
    //         mapControl.isochroneControl.highlightDestination(selectedPlaceId, { panTo: true });
    //     }
    // }

    // function setDestinationSidebarDetail(selectedPlaceId) {
    //     var selectedPlace = _.find(destinationsCache, {id: parseInt(selectedPlaceId)});
    //     if (selectedPlace && selectedPlace.name) {
    //         UserPreferences.setPreference('placeId', selectedPlaceId);
    //         updateUrl();
    //         var $detail = $(MapTemplates.destinationDetail(selectedPlace));
    //         $detail.find('.back').on('click', onDestinationDetailBackClicked);
    //         $detail.find('.getdirections').on('click', function() {
    //             events.trigger(eventNames.destinationDirections, selectedPlace);
    //         });
    //         $(options.selectors.destinations).html($detail);
    //     } else {
    //         onDestinationDetailBackClicked();
    //     }
    // }

    // function onDestinationDetailBackClicked() {
    //     selectedPlaceId = null;
    //     UserPreferences.setPreference('placeId', undefined);
    //     updateUrl();
    //     setDestinationSidebar(destinationsCache);
    //     mapControl.isochroneControl.highlightDestination(null);
    // }

    /* Update the URL based on current UserPreferences
     *
     * The placeId preference is set when there's a selected location and not when there's not,
     * so loading a URL with that param will cause the selected location to be re-selected.
     */
    function updateUrl() {
        urlRouter.updateUrl(urlRouter.buildExploreUrlFromPrefs());
    }

    function setFromUserPreferences() {
        var method = UserPreferences.getPreference('method');
        var mode = UserPreferences.getPreference('mode');
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        var exploreOrigin = UserPreferences.getPreference('origin');
        var exploreTime = UserPreferences.getPreference('exploreTime');
        var maxWalk = UserPreferences.getPreference('maxWalk');
        var wheelchair = UserPreferences.getPreference('wheelchair');

        // selectedPlaceId = UserPreferences.getPreference('placeId');

        if (exploreOrigin) {
            setAddress(exploreOrigin);
        } else {
            exploreLatLng = null;
        }

        // $(options.selectors.exploreTime).val(exploreTime);

        // modeOptionsControl.setMode(options.selectors.modeSelectors, mode);
        // $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        // use current date/time when loading from preferences
        var when = moment();

        // build options for query
        var otpOptions = { mode: mode };

        if (mode.indexOf('BICYCLE') > -1) {
            $.extend(otpOptions, {optimize: 'TRIANGLE'},
                     modeOptionsControl.options.bikeTriangle[bikeTriangle]);
        } else {
            if (maxWalk) {
                $.extend(otpOptions, { maxWalkDistance: maxWalk });
            }
            $.extend(otpOptions, { wheelchair: wheelchair });
        }

        if (method === 'explore' && exploreLatLng) {
            fetchIsochrone(when, exploreTime, otpOptions);
        }
    }

})(_, jQuery, CAC.Control.ModeOptions, CAC.Search.Geocoder, CAC.Map.Templates,
    CAC.Routing.Plans, CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
