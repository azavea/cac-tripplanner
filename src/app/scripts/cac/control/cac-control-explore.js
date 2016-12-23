/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.Explore = (function (_, $, Geocoder, MapTemplates, HomeTemplates, Routing, Typeahead,
                                 UserPreferences, Utils) {

    'use strict';

    // Number of millis to wait on input changes before sending isochrone request
    var ISOCHRONE_DEBOUNCE_MILLIS = 750;

    var defaults = {
        selectors: {
            alert: '.alert',
            hiddenClass: 'hidden',
            isochroneSliderContainer: '.isochrone-control',
            isochroneSlider: '#isochrone-slider',
            placesContent: '.places-content',
            spinner: '.places > .sk-spinner',
            placeCard: 'li.place-card',
            placesList: 'ul.place-list',
            noOriginClass: 'no-origin',
            placeOriginText: '.place-card-travel-logistics-origin',
            placeDistanceText: '.place-card-travel-logistics-duration',
            placeAttrX: 'data-destination-x',
            placeAttrY: 'data-destination-y'
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
            $(options.selectors.isochroneSliderContainer).removeClass(options.selectors.hiddenClass);
        } else {
            $(options.selectors.isochroneSliderContainer).addClass(options.selectors.hiddenClass);
        }

        // update isochrone on slider move
        $(options.selectors.isochroneSlider).change(clickedExplore);
    }

    var debouncedFetchIsochrone = _.debounce(fetchIsochrone, ISOCHRONE_DEBOUNCE_MILLIS);

    var getNearbyPlaces = _.throttle(_getNearbyPlaces, ISOCHRONE_DEBOUNCE_MILLIS);

    ExploreControl.prototype = {
        setAddress: setAddress,
        setOptions: setOptions,
        setFromUserPreferences: setFromUserPreferences,
        getNearbyPlaces: getNearbyPlaces
    };

    return ExploreControl;

    // When the explore tab is activated, do the thing. If some other tab is activated, clear the
    // isochrone and destination markers.
    function onTabShown(event, tabId) {
        if (tabId === tabControl.TABS.EXPLORE) {
            UserPreferences.setPreference('method', 'explore');
            setFromUserPreferences();
            $(options.selectors.isochroneSliderContainer).removeClass(options.selectors.hiddenClass);
        } else {
            $(options.selectors.alert).remove();
            mapControl.isochroneControl.clearIsochrone();
            mapControl.isochroneControl.clearDestinations();
            $(options.selectors.isochroneSliderContainer).addClass(options.selectors.hiddenClass);
        }
    }

    // trigger re-query when trip options are changed
    function setOptions() {
        clickedExplore();
        getNearbyPlaces();
    }

    // Helper to hide loading spinner and show places list
    function showPlacesContent() {
        $(options.selectors.spinner).addClass('hidden');
        $(options.selectors.placesContent).removeClass('hidden');
    }

    // Helper to hide places list and show loading spinner in its place
    function showSpinner() {
        $(options.selectors.placesContent).addClass('hidden');
        $(options.selectors.spinner).removeClass('hidden');
    }

    // If they move the marker, that invalidates the old isochrone and triggers the form to
    // reverse geocode the new location, so show the spinner while that happens.
    function onMovePointStart() {
        if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            showSpinner();
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
                setAddress(null);
                setError('Could not find street address for location.');
                directionsFormControl.setError('origin');
                showPlacesContent();
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
        showSpinner();
        $(options.selectors.alert).remove();
        mapControl.isochroneControl.clearIsochrone();

        debouncedFetchIsochrone();
    }

    /**
     * Load options and compose OTP params, fetch travelshed from OpenTripPlanner,
     * then populate side bar with featured locations found within the travelshed.
     */
    function fetchIsochrone() {
        // read slider
        var exploreMinutes = $(options.selectors.isochroneSlider).val();

        var otpOptions = getOtpOptions();

        var date = UserPreferences.getPreference('dateTime');
        date = date ? moment.unix(date) : moment(); // default to now

        // store search inputs to preferences
        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreMinutes', exploreMinutes);

        // Most interactions trigger this function, so updating the URL here keeps it mostly in sync
        // (the 'detail' functions don't update the isochrone so they update the URL themselves)
        updateUrl();

        // do not zoom to fit isochrone if going to highlight a selected destination
        // var zoomToFit = !selectedPlaceId;

        mapControl.isochroneControl.fetchIsochrone(exploreLatLng, date, exploreMinutes, otpOptions,
                                                   true).then(
            function (destinations) {
                showPlacesContent();
                if (!destinations) {
                    setError('No destinations found.');
                }
                // TODO: reimplement interaction between isochrone and places sidebar, if needed
                // setDestinationSidebar(destinations);
            }, function (error) {
                console.error(error);
                showPlacesContent();
                setError('Could not find travelshed for given origin.');
            }
        );
    }

    /**
     * Get parameters to pass to OpenTripPlanner, based on current settings
     *
     * @returns {Object} extra parameter set to pass to Routing.planTrip
     */
    function getOtpOptions() {
        var mode = UserPreferences.getPreference('mode');

        // options to pass to OTP as-is
        var otpOptions = {
            mode: mode,
            arriveBy: UserPreferences.getPreference('arriveBy'),
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

        return otpOptions;
    }

    function setError(message) {
        var $alert = $(MapTemplates.alert(message, 'Cannot show travelshed', 'danger'));
        var $container = $(options.selectors.placesContent);
        $container.html($alert);
        // handle close button
        $container.one('click', '.close', function () {
            $alert.remove();
        });
        showPlacesContent();
    }

    function onTypeaheadCleared(event, key) {
        if (key === 'origin') {
            exploreLatLng = null;
            // selectedPlaceId = null;
            $(options.selectors.alert).remove();
            mapControl.isochroneControl.clearIsochrone();
            getNearbyPlaces();
        }
    }

    function onTypeaheadSelected(event, key, location) {
        if (key === 'origin') {
            setAddress(location);
            // selectedPlaceId = null;
            if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
                clickedExplore();
            }
            getNearbyPlaces();
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
            $(options.selectors.alert).remove();
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
        var exploreOrigin = UserPreferences.getPreference('origin');

        if (exploreOrigin) {
            setAddress(exploreOrigin);
        } else {
            exploreLatLng = null;
        }

        // set explore time preference
        $(options.selectors.isochroneSlider).val(UserPreferences.getPreference('exploreMinutes'));

        if (exploreLatLng && tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            clickedExplore();
        }

        getNearbyPlaces();
    }

    function _getNearbyPlaces() {
        var $placeCards = $(options.selectors.placeCard);
        // hide existing times to places now showing (if any)
        $placeCards.addClass(options.selectors.noOriginClass);

        // if origin is blank, just hide travel times and bail
        if (!exploreLatLng) {
            return;
        }

        var searchUrl = '/api/destinations/search';

        $.ajax({
            url: searchUrl,
            type: 'GET',
            data: {
                lat: exploreLatLng[0],
                lon: exploreLatLng[1]
            },
        }).then(function(data) {
            if (!data.destinations) {
                console.error('no place search response');
                console.error(data);
                return;
            }

            var newPlaces = HomeTemplates.destinations(data.destinations);
            $(options.selectors.placesList).html(newPlaces);

            // now places list has been updated, go fetch the travel time
            // from the new origin to each place
            getTimesToPlaces();
        });
    }

    function getTimesToPlaces() {
        // make ajax requests to get the travel times to each destination
        var otpOptions = getOtpOptions();
        // only using the first itinerary; let OTP know to not bother finding other options
        $.extend(otpOptions, {numItineraries: 1});

        var date = UserPreferences.getPreference('dateTime');
        date = date ? moment.unix(date) : moment(); // default to now

        var $placeCards = $(options.selectors.placeCard);
        $placeCards.each(function() {
            var $card = $(this);

            // read out the location of the destination
            var xCoord = $card.attr(options.selectors.placeAttrX);
            var yCoord = $card.attr(options.selectors.placeAttrY);
            var placeCoords = [yCoord, xCoord];

            // origin text has not been updated on URL, so fromText not set on itineraries
            // get it from user preferences instead
            var originLabel = UserPreferences.getPreference('originText');

            // get travel time to destination and update place card
            Routing.planTrip(exploreLatLng, placeCoords, date, otpOptions)
            .then(function (itineraries) {
                if (itineraries && itineraries.length) {
                    var itinerary = itineraries[0];
                    $card.find(options.selectors.placeDistanceText)
                        .text(itinerary.formattedDuration);
                    $card.find(options.selectors.placeOriginText)
                        .text(originLabel);
                    $card.removeClass(options.selectors.noOriginClass);
                }
            });
        });
    }

})(_, jQuery, CAC.Search.Geocoder, CAC.Map.Templates, CAC.Home.Templates, CAC.Routing.Plans,
    CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
