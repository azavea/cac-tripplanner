/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.Explore = (function (_, $, MapTemplates, HomeTemplates, Routing, UserPreferences,
                                 Utils) {

    'use strict';

    // Number of millis to wait on input changes before sending isochrone request
    var ISOCHRONE_DEBOUNCE_MILLIS = 750;

    var defaults = {
        selectors: {
            alert: '.alert',
            closeButton: '.close',
            hiddenClass: 'hidden',
            isochroneSliderContainer: '.isochrone-control',
            isochroneSlider: '#isochrone-slider',
            isochroneOutput: '#output-directions-within',
            placesContent: '.places-content',
            spinner: '.places > .sk-spinner',
            placeCard: 'li.place-card',
            noOriginClass: 'no-origin',
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
    var fetchingIsochrone = false;

    var allDestinations = []; // cache full list of destinations
    var isochroneDestinationIds = null; // cache IDs of destinations within isochrone

    var events = $({});
    var eventNames = {
        destinationsLoaded: 'cac:explore:control:placesloaded',
    };

    function ExploreControl(params) {
        options = $.extend({}, defaults, params);
        this.events = events;
        this.eventNames = eventNames;

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
        directionsFormControl.events.on(directionsFormControl.eventNames.reversed,
                                        reverseOriginDestination);
        directionsFormControl.events.on(directionsFormControl.eventNames.geocodeError,
                                        onGeocodeError);

        showSpinner();

        if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            setFromUserPreferences();
            clickedExplore();
            $(options.selectors.isochroneSliderContainer).removeClass(options.selectors.hiddenClass);
        } else {
            $(options.selectors.isochroneSliderContainer).addClass(options.selectors.hiddenClass);
        }

        // update isochrone on slider move
        $(options.selectors.isochroneSlider).change(setOptions);
    }

    var fetchIsochrone = _.debounce(_fetchIsochrone, ISOCHRONE_DEBOUNCE_MILLIS);

    var getNearbyPlaces = _.debounce(_getNearbyPlaces, ISOCHRONE_DEBOUNCE_MILLIS);

    ExploreControl.prototype = {
        clickedExplore: clickedExplore,
        setAddress: setAddress,
        setOptions: setOptions,
        setFromUserPreferences: setFromUserPreferences,
        getNearbyPlaces: getNearbyPlaces,
        showPlacesContent: showPlacesContent,
        showSpinner: showSpinner
    };

    return ExploreControl;

    // When the explore tab is activated, load destinations and isochrone, if origin set.
    // If some other tab is activated, clear the isochrone and destination markers.
    function onTabShown(event, tabId) {
        // always show spinner on tab change, to avoid stale destinations list flashing
        showSpinner();
        if (tabId === tabControl.TABS.EXPLORE) {
            UserPreferences.setPreference('method', 'explore');
            setFromUserPreferences();
            $(options.selectors.isochroneSliderContainer).removeClass(options.selectors.hiddenClass);
            clickedExplore();
        } else {
            clearIsochrone();
            mapControl.isochroneControl.clearDestinations();
            $(options.selectors.isochroneSliderContainer).addClass(options.selectors.hiddenClass);
        }
    }

    // trigger re-query when trip options are changed
    function setOptions() {
        // set text output to match slider
        $(options.selectors.isochroneOutput).text($(options.selectors.isochroneSlider).val());
        if (exploreLatLng) {
            clickedExplore();
        }
    }

    // Helper to hide loading spinner and show places list
    function showPlacesContent() {
        if (!fetchingIsochrone) {
            $(options.selectors.spinner).addClass('hidden');
            $(options.selectors.placesContent).removeClass('hidden');
        }
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
            showPlacesContent();
            if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
                setAddress(null);
                setError('Could not find street address for location.');
                directionsFormControl.setError('origin');
            }
        }
    }

    /**
     * Show spinner and clear existing isochrone then fetch isochrone.
     * The fetchIsochrone call is debounced to cut down on requests.
     */
    function clickedExplore() {
        if (!tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            return;
        }
        showSpinner();
        clearIsochrone();

        if (exploreLatLng) {
            fetchIsochrone();
        } else {
            getNearbyPlaces();
        }
    }

    /**
     * Clears: isochrone from map, any isochrone query error,
     * and cache of destinations within isochrone.
     */
    function clearIsochrone() {
        // Null ID list to flag there is no isochrone to filter to,
        // as opposed to an empy list, which would indicate no matching destinations.
        isochroneDestinationIds = null;
        $(options.selectors.alert).remove();
        mapControl.isochroneControl.clearIsochrone();
    }

    /**
     * Load options and compose OTP params, fetch travelshed from OpenTripPlanner,
     * then populate side bar with featured locations found within the travelshed.
     */
    function _fetchIsochrone() {
        showSpinner();

        // do not hide spinner until isochrone fetch resolves
        // (in case of destinations being fetched simultaneously)
        fetchingIsochrone = true;

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
            function(data) {
                fetchingIsochrone = false;
                listIsochronePlaces(data);
            }, function(error) {
                console.error(error);
                fetchingIsochrone = false;
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
        if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
            var $alert = $(MapTemplates.alert(message, 'Cannot show travelshed', 'danger'));
            var $container = $(options.selectors.placesContent);
            $container.html($alert);
            // handle close button
            $container.one('click', options.selectors.closeButton, function () {
                $alert.remove();
                getNearbyPlaces();
            });
            showPlacesContent();
        }
    }

    function onTypeaheadCleared(event, key) {
        if (key === 'origin') {
            showSpinner();
            exploreLatLng = null;
            clearIsochrone();
            // get all places in sidebar when no origin set
            getNearbyPlaces();
        }
    }

    function onTypeaheadSelected(event, key, location) {
        if (key === 'origin') {
            setAddress(location);
            if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
                clickedExplore();
            } else {
                showSpinner();
                getNearbyPlaces();
            }
        }
    }

    // The reverse button doesn't trigger typeahead-selected events, but for our purposes it's the
    // same as selecting a new origin.
    function reverseOriginDestination(event, newOrigin) {
        onTypeaheadSelected(event, 'origin', newOrigin);
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
            clearIsochrone();
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
        // set explore time preference
        var exploreMinutes = UserPreferences.getPreference('exploreMinutes');
        $(options.selectors.isochroneSlider).val(exploreMinutes);
        $(options.selectors.isochroneOutput).text(exploreMinutes);


        var exploreOrigin = UserPreferences.getPreference('origin');

        if (exploreOrigin) {
            setAddress(exploreOrigin);
        } else {
            exploreLatLng = null;
        }
    }

    /**
     * Helper to build and show templated place cards
     *
     * @param destinations {Array} Detination objects to load into template cards
     * @Param exploreMinutes {String} String representation of integer number of travel minutes
                                     the travelshed encompasses; -1 if not in travelshed mode
     */
    function displayPlaces(destinations, exploreMinutes) {
        exploreMinutes = exploreMinutes || '-1';
        var isTransit = UserPreferences.getPreference('mode').indexOf('TRANSIT') > -1;
        var isMax = (exploreMinutes === $(options.selectors.isochroneSlider).prop('max'));

        // alternate text string to display if there are no destinations found
        var text = null;
        if (!destinations || !destinations.length) {
            if (exploreMinutes === '-1') {
                // not in travel mode; if none found, none match destination category filter
                text = 'No featured destinations found.';
            } else if (!isTransit && !isMax) {
                text = 'No featured destinations within ' + exploreMinutes +
                    ' minutes. Try including transit or allowing for more time.';
            } else if (!isTransit && isMax) {
                text = 'No featured destinations within ' + exploreMinutes +
                    ' minutes. Try including transit, or removing the travel time limit ' +
                    '(click \"within\" above).';
            } else if (isTransit && !isMax) {
                text = 'No featured destinations within ' + exploreMinutes +
                    ' minutes. Try allowing for more time.';
            } else {
                text = 'No featured destinations within ' + exploreMinutes +
                    ' minutes. Try removing the travel time limit (click \"within\" above).';
            }
        }

        // Now places list has been updated, go fetch the travel time to each
        // from the new origin to each place.
        var promises = getTimesToPlaces(destinations);
        $.when.apply($, promises).always(function() {

            // order the destinations by travel time
            destinations = _.sortBy(destinations, ['duration']);
            var places = HomeTemplates.destinations(destinations,
                                                    text,
                                                    tabControl.isTabShowing(tabControl.TABS.HOME));
            $(options.selectors.placesContent).html(places);
            // send event that places content changed
            events.trigger(eventNames.destinationsLoaded);

            // also draw all destinations on explore map that match the category filter
            // (not just those in the isochrone)
            if (tabControl.isTabShowing(tabControl.TABS.EXPLORE) && mapControl.isLoaded()) {
                // allDestinations has been loaded by now
                mapControl.isochroneControl.drawDestinations(filterPlacesCategory(allDestinations),
                                                             destinations);
            }

            showPlacesContent();
        });
    }

    // Given desintations from the FindReachableDestinations app endpoint,
    // use the returned list of places within the travelshed
    // to filter displayed destinations and events in the sidebar cards.
    function listIsochronePlaces(destinations) {
        showSpinner();
        var $placeCards = $(options.selectors.placeCard);
        // hide existing times to places now showing (if any)
        $placeCards.addClass(options.selectors.noOriginClass);
        isochroneDestinationIds = _.flatMap(destinations, 'id');

        // use cached results for all destinations and events, if present
        var filter = UserPreferences.getPreference('destinationFilter');
        var isochroneSize = $(options.selectors.isochroneSlider).val();
        if (allDestinations.length > 0) {
            displayPlaces(filterPlaces(allDestinations, filter), isochroneSize);
            return;
        }

        getAllPlaces().then(function(data) {
            setDestinationsEvents(data);
            displayPlaces(filterPlaces(allDestinations, filter), isochroneSize);
        }).fail(function(error) {
            console.error('error fetching destinations:');
            console.error(error);
            setDestinationsEvents();
            showPlacesContent();
        });
    }

    /**
     * Filter destinations by both isochrone and category client-side.
     *
     * @param filter {String} destination category to filter for a match
     * returns {Array} filtered destinations list
     */
    function filterPlaces(places) {
        // Only filter by category if no isochrone filter currently set;
        // will include events without a destination.
        if (_.isNull(isochroneDestinationIds)) {
            return filterPlacesCategory(places);
        }

        // Filter by both isochrone and category.
        // For events without a destination (placeID), exclude from results
        return filterPlacesCategory(_.filter(places, function(place) {
            return _.includes(isochroneDestinationIds, place.placeID) ? place.placeID: false;
        }));
    }

    /**
     * Filter destinations by category client-side.
     *
     * @param filter {String} destination category to filter for a match
     * returns {Array} filtered destinations and/or events list
     */
    function filterPlacesCategory(places) {
        var filter = UserPreferences.getPreference('destinationFilter');
        if (!filter || filter === 'All') {
            return places;
        }

        return _.filter(places, function(place) {
            return _.indexOf(place.categories, filter) > -1;
        });
    }

    /**
     * Query Django app for all destinations. If origin set, will order by distance.
     *
     * @return {promise} Promise which resolves to list of destinations
     */
    function getAllPlaces() {
        var dfd = $.Deferred();
        var searchUrl = '/api/destinations/search';
        var params = {
            url: searchUrl,
            type: 'GET'
        };

        if (!exploreLatLng) {
            // if origin is not set, re-fetch all by querying with a blank text search
            params.data = {text: ''};
        } else {
            // use origin
            params.data = {
                lat: exploreLatLng[0],
                lon: exploreLatLng[1]
            };
        }

        $.ajax(params).done(function(data) {
            if (!data || !data.destinations) {
                console.error('no places found');
                console.error(data);
                dfd.resolve([]);
            } else {
                dfd.resolve(data);
            }
        }).fail(function(error) {
            console.error('error fetching destinations:');
            console.error(error);
            dfd.reject();
        });
        return dfd.promise();
    }

    function _getNearbyPlaces() {
        var filter = UserPreferences.getPreference('destinationFilter');
        showSpinner();
        var $placeCards = $(options.selectors.placeCard);
        // hide existing times to places now showing (if any)
        $placeCards.addClass(options.selectors.noOriginClass);

        // use cached results
        if (allDestinations.length > 0) {
            displayPlaces(filterPlaces(allDestinations, filter), '-1');
            return;
        }

        getAllPlaces().then(function(data) {
            setDestinationsEvents(data);
            displayPlaces(filterPlaces(allDestinations, filter), '-1');
        }).fail(function(error) {
            console.error('error fetching destinations:');
            console.error(error);
            setDestinationsEvents();
            showPlacesContent();
        });
    }

    /** Get travel times from the orign to each destination.
     *  Should be called before displaying place list.
     *
     * @param destinations {Array} Destination and event objects that will be changed in-place
     * @returns {Array} Collection of promises, each of which resolve to a destination
     */
    function getTimesToPlaces(destinations) {
        // if origin not set, simply clear the travel times from the destinations
        if (!exploreLatLng) {
            _.each(destinations, function(destination) {
                destination.duration = undefined;
                destination.formattedDuration = undefined;
                destination.originLabel = undefined;
            });
            return;
        }

        // make ajax requests to get the travel times to each destination
        var otpOptions = getOtpOptions();
        // only using the first itinerary; let OTP know to not bother finding other options
        $.extend(otpOptions, {numItineraries: 1});

        var date = UserPreferences.getPreference('dateTime');
        date = date ? moment.unix(date) : moment(); // default to now

        // prefer to label with just the street address, and fall back to full address
        // for featured places, use the label in the 'name' attribute instead of the address
        var origin = UserPreferences.getPreference('origin');
        var originLabel = origin.name ? origin.name :
            (origin.attributes && origin.attributes.StAddr ? origin.attributes.StAddr :
            UserPreferences.getPreference('originText'));

        var promises = _.map(destinations, function(destination) {
            var dfd = $.Deferred();
            // if already have travel time to destination, skip requerying for it
            if (destination.originLabel === originLabel) {
                dfd.resolve(destination);
                return dfd.promise();
            }

            // read out the location of the destination
            var xCoord = destination.location.x;
            var yCoord = destination.location.y;

            if (xCoord && yCoord) {
                var placeCoords = [yCoord, xCoord];
                // get travel time to destination and update place card
                Routing.planTrip(exploreLatLng, placeCoords, date, otpOptions)
                .then(function (itineraries) {
                    if (itineraries && itineraries.length) {
                        var itinerary = itineraries[0];
                        // set properties for travel time to place and the origin label
                        destination.duration = itinerary.duration;
                        destination.formattedDuration = itinerary.formattedDuration;
                        destination.originLabel = originLabel;
                        dfd.resolve(destination);
                    }
                }).fail(function(error) {
                    console.error('error finding travel time to ' + destination.name);
                    console.error(error);
                    dfd.reject(error);
                });
            } else {
                // event without a location
                dfd.resolve(destination);
            }
            return dfd.promise();
        });

        return promises;
    }

    /**
     * Locally cache response of destination search endpoint.
     *
     * Sets both destinations and events. If given empty data, will unset local cache.
     *
     * @param data {Object} response from getAllPlaces
     */
    function setDestinationsEvents(data) {
        if (!data) {
            allDestinations = [];
            return;
        }
        allDestinations = data.destinations.concat(data.events);
    }

})(_, jQuery, CAC.Map.Templates, CAC.Home.Templates, CAC.Routing.Plans, CAC.User.Preferences,
   CAC.Utils);
