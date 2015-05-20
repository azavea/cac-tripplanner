/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.SidebarExplore = (function (_, $, BikeModeOptions, Geocoder, MapTemplates, Routing,
                              Typeahead, UserPreferences, Utils) {

    'use strict';

    var METERS_PER_MILE = 1609.34;

    // Number of millis to wait on input changes before sending isochrone request
    var ISOCHRONE_DEBOUNCE_MILLIS = 750;

    var defaults = {
        selectors: {
            bikeTriangleDiv: '#exploreBikeTriangle',
            datepicker: '#datetimeExplore',
            destinations: '.destinations',
            distanceMinutesText: '.distance-minutes',
            errorClass: 'error',
            exploreTime: '#exploreTime',
            isochroneInput: '.isochrone-input',
            maxWalkDiv: '#exploreMaxWalk',
            modeSelectors: '#exploreModes input',
            optionsMore: '.sidebar-options .more-options',
            optionsViewMore: '.sidebar-options .view-more',
            sidebarContainer: '.explore .sidebar-clip',
            spinner: '.explore div.sidebar-details > .sk-spinner',
            submitExplore: 'section.explore button[type=submit]',
            submitSearch: '.sidebar-search button[type="submit"]',
            typeahead: 'section.explore input.typeahead',
            wheelchairDiv: '#exploreWheelchair'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        destinationDirections: 'cac:control:sidebarexplore:destinationdirections'
    };

    var bikeModeOptions = null;
    var datepicker = null;
    var mapControl = null;
    var typeahead = null;
    var exploreLatLng = null;
    var selectedDestination = null;
    var destinationsCache = [];

    function SidebarExploreControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        bikeModeOptions = new BikeModeOptions();

        // initiallize date/time picker
        datepicker = $(options.selectors.datepicker).datetimepicker({
            useCurrent: true,
            format: 'h:mma on M/D/YY',
            showTodayButton: true
        });
        datepicker.on('dp.change', clickedExplore);

        $(options.selectors.modeSelectors).change($.proxy(changeMode, this));

        $(options.selectors.optionsViewMore).click(showOptions);

        // Show isochrone in discovery tab
        $(options.selectors.submitExplore).click(clickedExplore);

        $(options.selectors.submitSearch).on('click', function(){
            $('.explore').addClass('show-results');
        });

        typeahead = new Typeahead(options.selectors.typeahead);
        typeahead.events.on(typeahead.eventNames.selected, onTypeaheadSelected);
        typeahead.events.on(typeahead.eventNames.cleared, onTypeaheadCleared);

        setFromUserPreferences();

        // Respond to changes on all isochrone input fields
        $(options.selectors.isochroneInput).on('input change', clickedExplore);
    }

    SidebarExploreControl.prototype = {
        events: events,
        eventNames: eventNames,
        movedPoint: movedPoint,
        setAddress: setAddress,
        setDestinationSidebar: setDestinationSidebar,
        setFromUserPreferences: setFromUserPreferences
    };

    function movedPoint(position) {
        // show spinner while loading
        $(options.selectors.destinations).addClass('hidden');
        $(options.selectors.spinner).removeClass('hidden');

        // update location
        exploreLatLng = [position.lat, position.lng];

        Geocoder.reverse(position.lat, position.lng).then(function (data) {
            if (data && data.address) {
                var location = Utils.convertReverseGeocodeToFeature(data);
                /*jshint camelcase: false */
                var fullAddress = data.address.Match_addr;
                /*jshint camelcase: true */
                UserPreferences.setPreference('originText', fullAddress);
                UserPreferences.setPreference('origin', location);
                $('div.address > h4').html(MapTemplates.addressText(fullAddress));
                $(options.selectors.typeahead).typeahead('val', fullAddress).change();
                clickedExplore();
            } else {
                addressHasError(null);
                setError('Could not find street address for location.');
                $(options.selectors.destinations).removeClass('hidden');
                $(options.selectors.spinner).addClass('hidden');
            }
        });
    }

    /**
     * Set user preferences before fetching isochrone.
     * This function has been debounced to cut down on requests.
     */
    var clickedExplore = _.debounce(function() {
        if (addressHasError(exploreLatLng)) {
            return;
        }

        var exploreMinutes = $(options.selectors.exploreTime).val();

        var picker = $(options.selectors.datepicker).data('DateTimePicker');
        var date = picker.date();
        if (!date) {
            // use current date/time if none set
            date = moment();
        }

        var mode = bikeModeOptions.getMode(options.selectors.modeSelectors);
        var otpOptions = { mode: mode };

        if (mode.indexOf('BICYCLE') > -1) {
            var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
            var bikeTriangle = bikeTriangleOpt.val();
            $.extend(otpOptions, {optimize: 'TRIANGLE'}, bikeModeOptions.options.bikeTriangle[bikeTriangle]);
            UserPreferences.setPreference('bikeTriangle', bikeTriangle);
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

        // store search inputs to preferences
        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreMinutes);
        UserPreferences.setPreference('mode', mode);

        fetchIsochrone(date, exploreMinutes, otpOptions);
    }, ISOCHRONE_DEBOUNCE_MILLIS);

    return SidebarExploreControl;

    function changeMode() {
        bikeModeOptions.changeMode(options.selectors);
        clickedExplore();
    }

    /**
     * Fetch travelshed from OpenTripPlanner, then populate side bar with featured locations
     * found within the travelshed.
     *
     * @param {Object} when Moment.js time for the search (default to now)
     * @param {String} mode String for travel mode to pass to OTP (walk, transit, etc.)
     * @param {Number} exploreMinutes Number of minutes of travel for the isochrone limit
     */
    function fetchIsochrone(when, exploreMinutes, otpOptions) {
        $(options.selectors.destinations).addClass('hidden');
        $(options.selectors.spinner).removeClass('hidden');
        mapControl.fetchIsochrone(exploreLatLng, when, exploreMinutes, otpOptions).then(
            function (destinations) {
                $(options.selectors.spinner).addClass('hidden');
                $(options.selectors.destinations).removeClass('hidden');
                if (!destinations) {
                    setError('No destinations found.');
                }
                setDestinationSidebar(destinations);
            }, function (error) {
                console.error(error);
                $(options.selectors.spinner).addClass('hidden');
                $(options.selectors.destinations).removeClass('hidden');
                setError('Could not find travelshed.');
            }
        );
    }

    function onTypeaheadCleared() {
        UserPreferences.setPreference('origin', undefined);
        UserPreferences.setPreference('originText', undefined);
        exploreLatLng = null;
        selectedDestination = null;
        mapControl.clearDiscoverPlaces();
    }

    function onTypeaheadSelected(event, key, location) {
        UserPreferences.setPreference('origin', location);
        UserPreferences.setPreference('originText', location.name);
        setAddress(location);
        selectedDestination = null;
        clickedExplore();
    }

    /**
     * Returns true if given location is missing (address is not valid)
     *
     * @params {Object} location Geocoded location object (truthy if ok)
     * @returns {Boolean} true if location is falsy
     */
    function addressHasError(location) {
        var $input = $(options.selectors.typeahead);

        if (location) {
            $input.removeClass(options.selectors.errorClass);
            return false;
        } else {
            exploreLatLng = null;
            UserPreferences.setPreference('origin', undefined);
            UserPreferences.setPreference('originText', undefined);
            $input.addClass(options.selectors.errorClass);
            mapControl.clearDiscoverPlaces();
            return true;
        }
    }

    function showOptions(event) {
        var parent = $(event.target).closest('section');
        var moreOpt = $(options.selectors.optionsMore, parent);

        $(moreOpt).toggleClass('active');
        $(moreOpt).parent().find('a.view-more').text(function() {
            if($(moreOpt).hasClass('active')){
                return 'View fewer options';
            } else {
                return 'View more options';
            }
        });
    }

    function setAddress(location) {
        if (addressHasError(location)) {
            return;
        }
        var latLng = L.latLng(location.feature.geometry.y, location.feature.geometry.x);
        exploreLatLng = [location.feature.geometry.y, location.feature.geometry.x];
        mapControl.setGeocodeMarker(latLng);
        $('div.address > h4').html(MapTemplates.addressText(location.feature.attributes));
    }

    /**
     * Query OTP for travel time to a destination, then put it in the side panel.
     *
     * @param {Object} destination Destination put in the sidebar
     */
    function setDestinationDistance(destination) {

        // helper to set the text snippet
        function setDestinationMinutesText(distanceMinutes) {
            var $destination = $('#destination-' + destination.id);
            $destination.find(options.selectors.distanceMinutesText)
                .text(distanceMinutes + ' minutes away');
        }

        // first check if we have distance cached
        if (destination.formattedDuration) {
            setDestinationMinutesText(destination.formattedDuration);
            return;
        }

        // distance not cached; go query for it
        var mode = UserPreferences.getPreference('mode');
        var picker = $(options.selectors.datepicker).data('DateTimePicker');
        var date = picker.date();
        if (!date) {
            // use current date/time if none set
            date = moment();
        }
        // only request one itinerary (first returned is the shortest)
        var otpOptions = { mode: mode, numItineraries: 1 };
        if (mode.indexOf('BICYCLE') > -1) {
            var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
            var bikeTriangle = bikeTriangleOpt.val();
            $.extend(otpOptions, {optimize: 'TRIANGLE'},
                     bikeModeOptions.options.bikeTriangle[bikeTriangle]);
        } else {
            var maxWalk = $('input', options.selectors.maxWalkDiv).val();
            if (maxWalk) {
                $.extend(otpOptions, { maxWalkDistance: maxWalk * METERS_PER_MILE });
            }
            // true if box checked
            var wheelchair = $('input', options.selectors.wheelchairDiv).prop('checked');
            $.extend(otpOptions, { wheelchair: wheelchair });
        }

        var dest = [destination.point.coordinates[1], destination.point.coordinates[0]];

        Routing.planTrip(exploreLatLng, dest, date, otpOptions)
            .then(function (itineraries) {
            if (itineraries.length) {
                var distance = itineraries[0].formattedDuration;
                destination.formattedDuration = distance;
                setDestinationMinutesText(distance);
            }
        });
    }

    function setDestinationSidebar(destinations) {
        destinationsCache = destinations;
        if (!destinations) {
            return;
        }
        var $container = $('<div></div>').addClass('destinations');
        $.each(destinations, function (i, destination) {
            var $destination = $(MapTemplates.destinationBlock(destination));
            $destination.click(function () {
                setDestinationSidebarDetail(destination);
                mapControl.highlightDestination(destination.id, { panTo: true });
            });
            $destination.hover(function () {
                mapControl.highlightDestination(destination.id);
            }, function () {
                mapControl.highlightDestination(null);
            });
            $container.append($destination);
        });
        $(options.selectors.destinations).html($container);
        // go find distances once the sidebar templates have been added to DOM
        $.each(destinations, function(i, destination) {
            setDestinationDistance(destination);
        });
        $(options.selectors.sidebarContainer).height(400);

        // show destination details if destination is selected
        if (selectedDestination) {
            setDestinationSidebarDetail(selectedDestination);
            selectedDestination = null;
        }
    }

    function setError(message) {
        var $container = $('<div></div>').addClass('destinations');
        var $errorTemplate = $(MapTemplates.destinationError({'message': message}));
        $container.append($errorTemplate);
        $(options.selectors.destinations).html($container);
        $(options.selectors.sidebarContainer).height(200);
    }

    function setDestinationSidebarDetail(destination) {
        var $detail = $(MapTemplates.destinationDetail(destination));
        $detail.find('.back').on('click', onDestinationDetailBackClicked);
        $detail.find('.getdirections').on('click', function() {
            events.trigger(eventNames.destinationDirections, destination);
        });
        $(options.selectors.destinations).html($detail);
    }

    function onDestinationDetailBackClicked() {
        setDestinationSidebar(destinationsCache);
        mapControl.highlightDestination(null);
    }

    function setFromUserPreferences() {
        var method = UserPreferences.getPreference('method');
        var mode = UserPreferences.getPreference('mode');
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        var destination = UserPreferences.getPreference('to');
        var exploreOrigin = UserPreferences.getPreference('origin');
        var originText = UserPreferences.getPreference('originText');
        var exploreTime = UserPreferences.getPreference('exploreTime');
        var maxWalk = UserPreferences.getPreference('maxWalk');
        var wheelchair = UserPreferences.getPreference('wheelchair');

        if (exploreOrigin) {
            exploreLatLng = [exploreOrigin.feature.geometry.y,
                             exploreOrigin.feature.geometry.x];
            $(options.selectors.typeahead).typeahead('val', originText).change();
            setAddress(exploreOrigin);
        } else {
            exploreLatLng = null;
        }

        $(options.selectors.exploreTime).val(exploreTime);

        bikeModeOptions.setMode(options.selectors.modeSelectors, mode);
        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        // use current date/time when loading from preferences
        var when = moment();

        // build options for query
        var otpOptions = { mode: mode };

        if (mode.indexOf('BICYCLE') > -1) {
            $.extend(otpOptions, {optimize: 'TRIANGLE'},
                     bikeModeOptions.options.bikeTriangle[bikeTriangle]);
        } else {
            if (maxWalk) {
                $.extend(otpOptions, { maxWalkDistance: maxWalk * METERS_PER_MILE });
            }
            $.extend(otpOptions, { wheelchair: wheelchair });
        }

        if (wheelchair) {
            $('input', options.selectors.wheelchairDiv).click();
        }

        if (maxWalk) {
            $('input', options.selectors.maxWalkDiv).val(maxWalk);
        }

        if (method === 'explore' && exploreLatLng) {
            fetchIsochrone(when, exploreTime, otpOptions);
            // show destination details if destination selected on homepage
            if (_.has(destination, 'id')) {
                selectedDestination = destination;
            } else {
                selectedDestination = null;
            }
        }
    }

})(_, jQuery, CAC.Control.BikeModeOptions, CAC.Search.Geocoder, CAC.Map.Templates,
    CAC.Routing.Plans, CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
