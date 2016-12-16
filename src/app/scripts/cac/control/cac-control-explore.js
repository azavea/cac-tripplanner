/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.Explore = (function (_, $, Geocoder, MapTemplates, Routing, Typeahead,
                                 UserPreferences, Utils) {

    'use strict';

    // Number of millis to wait on input changes before sending isochrone request
    var ISOCHRONE_DEBOUNCE_MILLIS = 750;

    var defaults = {
        selectors: {
            placesList: '.places-content',
            spinner: '.places > .sk-spinner',
        }
    };
    var options = {};

    var mapControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsFormControl = null;
    var exploreLatLng = null;

    function ExploreControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;
        urlRouter = options.urlRouter;
        directionsFormControl = options.directionsFormControl;

        mapControl.events.on(mapControl.eventNames.originMoved, onMovePointStart);

        tabControl.events.on(tabControl.eventNames.tabShown, onTabShown);

        directionsFormControl.events.on(directionsFormControl.eventNames.selected,
                                        onTypeaheadSelected);
        directionsFormControl.events.on(directionsFormControl.eventNames.cleared,
                                        onTypeaheadCleared);
        directionsFormControl.events.on(directionsFormControl.eventNames.geocodeError,
                                        onGeocodeError);

        if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            setFromUserPreferences();
        }
    }

    var debouncedFetchIsochrone = _.debounce(fetchIsochrone, ISOCHRONE_DEBOUNCE_MILLIS);

    ExploreControl.prototype = {
        setAddress: setAddress,
        setOptions: setOptions,
        setFromUserPreferences: setFromUserPreferences
    };

    return ExploreControl;

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

    // trigger re-query when trip options are changed
    function setOptions() {
        clickedExplore();
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
     * Show spinner and clear existing isochrone then fetch isochrone.
     * The fetchIsochrone call is debounced to cut down on requests.
     */
    function clickedExplore() {
        if (!exploreLatLng || !tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            return;
        }
        $(options.selectors.placesList).addClass('hidden');
        $(options.selectors.spinner).removeClass('hidden');
        mapControl.isochroneControl.clearIsochrone();

        debouncedFetchIsochrone();
    }

    /**
     * Load options and compose OTP params, fetch travelshed from OpenTripPlanner,
     * then populate side bar with featured locations found within the travelshed.
     */
    function fetchIsochrone() {
        // TODO: replace placeholder with value from slider
        var exploreMinutes = 20;

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

        var date = UserPreferences.getPreference('dateTime');
        date = date ? moment.unix(date) : moment(); // default to now

        // store search inputs to preferences
        UserPreferences.setPreference('method', 'explore');
        // UserPreferences.setPreference('exploreTime', exploreMinutes);

        // Most interactions trigger this function, so updating the URL here keeps it mostly in sync
        // (the 'detail' functions don't update the isochrone so they update the URL themselves)
        updateUrl();

        // do not zoom to fit isochrone if going to highlight a selected destination
        // var zoomToFit = !selectedPlaceId;

        mapControl.isochroneControl.fetchIsochrone(exploreLatLng, date, exploreMinutes, otpOptions,
                                                   true).then(
            function (destinations) {
                $(options.selectors.spinner).addClass('hidden');
                $(options.selectors.placesList).removeClass('hidden');
                if (!destinations) {
                    setError('No destinations found.');
                }
                // TODO: reimplement interaction between isochrone and places sidebar, if needed
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
        var exploreOrigin = UserPreferences.getPreference('origin');

        if (exploreOrigin) {
            setAddress(exploreOrigin);
        } else {
            exploreLatLng = null;
        }

        if (method === 'explore' && exploreLatLng) {
            clickedExplore();
        }
    }

})(_, jQuery, CAC.Search.Geocoder, CAC.Map.Templates, CAC.Routing.Plans, CAC.Search.Typeahead,
   CAC.User.Preferences, CAC.Utils);
