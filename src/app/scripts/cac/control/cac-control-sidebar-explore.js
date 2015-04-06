/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.SidebarExplore = (function ($, BikeOptions, MapTemplates, Routing, Typeahead, UserPreferences) {

    'use strict';

    var METERS_PER_MILE = 1609.34;

    var defaults = {
        selectors: {
            bikeTriangleDiv: '#exploreBikeTriangle',
            datepicker: '#datetimeExplore',
            destinations: '.destinations',
            distanceMinutesText: '.distanceMinutes',
            errorClass: 'error',
            exploreOrigin: '#exploreOrigin',
            exploreTime: '#exploreTime',
            maxWalkDiv: '#exploreMaxWalk',
            modeSelector: '#exploreModeSelector',
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

    var bikeOptions = null;
    var datepicker = null;
    var mapControl = null;
    var typeahead = null;
    var exploreLatLng = null;
    var destinationsCache = [];

    function SidebarExploreControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        bikeOptions = new BikeOptions();

        // initiallize date/time picker
        datepicker = $(options.selectors.datepicker).datetimepicker({useCurrent: true});

        $(options.selectors.modeSelector).change($.proxy(changeMode, this));

        $(options.selectors.optionsViewMore).click(showOptions);

        // Show isochrone in discovery tab
        $(options.selectors.submitExplore).click(clickedExplore);

        $(options.selectors.submitSearch).on('click', function(){
            $('.explore').addClass('show-results');
        });

        typeahead  = new Typeahead(options.selectors.typeahead);
        typeahead.events.on('cac:typeahead:selected', onTypeaheadSelected);

        setFromUserPreferences();
        changeMode();
    }

    SidebarExploreControl.prototype = {
        events: events,
        setAddress: setAddress,
        setDestinationSidebar: setDestinationSidebar
    };

    return SidebarExploreControl;

    function changeMode() {
        bikeOptions.changeMode(options.selectors);
    }

    /**
     * Set user preferences before fetching isochrone.
     */
    function clickedExplore() {

        if (addressHasError(exploreLatLng)) {
            return;
        }

        var exploreMinutes = $(options.selectors.exploreTime).val();
        var mode = $(options.selectors.modeSelector).val();

        var picker = $(options.selectors.datepicker).data('DateTimePicker');
        var date = picker.date();
        if (!date) {
            // use current date/time if none set
            date = moment();
        }

        var otpOptions = { mode: mode };

        if (mode.indexOf('BICYCLE') > -1) {
            var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
            var bikeTriangle = bikeTriangleOpt.val();
            $.extend(otpOptions, {optimize: 'TRIANGLE'}, bikeOptions.options.bikeTriangle[bikeTriangle]);
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
        UserPreferences.setPreference('originText', $(options.selectors.exploreOrigin).val());
        UserPreferences.setPreference('exploreTime', exploreMinutes);
        UserPreferences.setPreference('mode', mode);

        fetchIsochrone(date, exploreMinutes, otpOptions);
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
                    return;
                }
                setDestinationSidebar(destinations);
            }
        );
    }

    function onTypeaheadSelected(event, key, location) {
        // TODO: Deleting text from input elements does not delete directions object values
        if (key === 'search') {
            UserPreferences.setPreference('origin', location);
            setAddress(location);
        } else {
            console.error('Unrecognized typeahead key ' + key + ' in explore tab.');
        }
    }

    /**
     * Returns true if given location is missing (address is not valid)
     *
     * @params {Object} location Geocoded location object (truthy if ok)
     * @returns {Boolean} true if location is falsy
     */
    function addressHasError(location) {
        var $input = $(options.selectors.exploreOrigin);

        if (location) {
            $input.removeClass(options.selectors.errorClass);
            return false;
        } else {
            exploreLatLng = null;
            UserPreferences.setPreference('origin', undefined);
            $input.addClass(options.selectors.errorClass);
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
     * @param {Object} $container jQuery-selected HTML snippet in the sidebar for the destination
     */
    function setDestinationDistance(destination, $container) {
        var mode = $(options.selectors.modeSelector).val();
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
            $.extend(otpOptions, {optimize: 'TRIANGLE'}, bikeOptions.options.bikeTriangle[bikeTriangle]);
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
                var distance = itineraries[0].durationMinutes;
                destination.durationMinutes = distance;
                $container.find(options.selectors.distanceMinutesText).text(distance + ' minutes away');
            }
        });
    }

    function setDestinationSidebar(destinations) {
        destinationsCache = destinations;
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
            setDestinationDistance(destination, $destination);
        });
        $(options.selectors.destinations).html($container);
        $(options.selectors.sidebarContainer).height(400);
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
        var exploreOrigin = UserPreferences.getPreference('origin');
        exploreLatLng = [exploreOrigin.feature.geometry.y,
                                    exploreOrigin.feature.geometry.x];
        var originText = UserPreferences.getPreference('originText');
        var exploreTime = UserPreferences.getPreference('exploreTime');
        var maxWalk = UserPreferences.getPreference('maxWalk');
        var wheelchair = UserPreferences.getPreference('wheelchair');

        setAddress(exploreOrigin);

        $(options.selectors.exploreOrigin).typeahead('val', originText);
        $(options.selectors.exploreTime).val(exploreTime);
        $(options.selectors.modeSelector).val(mode);
        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        // use current date/time when loading from preferences
        var when = moment();

        // build options for query
        var otpOptions = { mode: mode };

        if (mode.indexOf('BICYCLE') > -1) {
            $.extend(otpOptions, {optimize: 'TRIANGLE'}, bikeOptions.options.bikeTriangle[bikeTriangle]);
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

        if (method === 'explore') {
            fetchIsochrone(when, exploreTime, otpOptions);
        }
    }

})(jQuery, CAC.Control.BikeOptions, CAC.Map.Templates, CAC.Routing.Plans, CAC.Search.Typeahead,
   CAC.User.Preferences);
