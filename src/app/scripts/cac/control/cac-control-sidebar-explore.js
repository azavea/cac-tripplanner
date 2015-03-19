/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.SidebarExplore = (function ($, MapTemplates, Typeahead, UserPreferences) {

    'use strict';

    var defaults = {
        selectors: {
            bikeTriangleDiv: '#exploreBikeTriangle',
            checkboxArriveBy: 'input[name="arriveByExplore"]:checked',
            datepicker: '#datetimeExplore',
            departAtButton: 'input[name="arriveByExplore"]:eq(1)',
            exploreOrigin: '#exploreOrigin',
            exploreTime: '#exploreTime',
            maxWalkDiv: '#exploreMaxWalk',
            modeSelector: '#exploreModeSelector',
            optionsMore: '.sidebar-options .more-options',
            optionsViewMore: '.sidebar-options .view-more',
            sidebarContainer: '.explore .sidebar-clip',
            sidebarDetails: '.explore div.sidebar-details',
            submitExplore: 'section.explore button[type=submit]',
            submitSearch: '.sidebar-search button[type="submit"]',
            typeahead: 'section.explore input.typeahead',
            wheelchairDiv: '#exploreWheelchair'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        destinationSelected: 'cac:control:sidebarexplore:destinationselected',
        destinationDirections: 'cac:control:sidebarexplore:destinationdirections'
    };

    var datepicker = null;
    var mapControl = null;
    var typeahead = null;
    var exploreLatLng = [0,0];
    var destinationsCache = [];

    function SidebarExploreControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;

        // initiallize date/time picker
        datepicker = $(options.selectors.datepicker).datetimepicker({useCurrent: true});

        $(options.selectors.modeSelector).click($.proxy(changeMode, this));

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
        mapControl.changeMode(options.selectors);
    }

    /**
     * Set user preferences before fetching isochrone.
     */
    function clickedExplore() {
        var exploreMinutes = $(options.selectors.exploreTime).val();
        var mode = $(options.selectors.modeSelector).val();

        var picker = $(options.selectors.datepicker).data('DateTimePicker');
        var date = picker.date();
        if (!date) {
            // use current date/time if none set
            date = moment();
        }

        // store search inputs to preferences
        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('originText', $(options.selectors.exploreOrigin).val());
        UserPreferences.setPreference('exploreTime', exploreMinutes);
        UserPreferences.setPreference('mode', mode);

        fetchIsochrone(date, mode, exploreMinutes);
    }

    /**
     * Fetch travelshed from OpenTripPlanner, then populate side bar with featured locations
     * found within the travelshed.
     *
     * @param {Object} when Moment.js time for the search (default to now)
     * @param {String} mode String for travel mode to pass to OTP (walk, transit, etc.)
     * @param {Number} exploreMinutes Number of minutes of travel for the isochrone limit
     */
    function fetchIsochrone(when, mode, exploreMinutes) {
        mapControl.fetchIsochrone(exploreLatLng, when, mode, exploreMinutes).then(
            function (destinations) {
                setDestinationSidebar(destinations);
            }
        );
    }

    function onTypeaheadSelected(event, key, location) {
        // TODO: Deleting text from input elements does not delete directions object values
        if (key === 'search') {
            UserPreferences.setPreference('origin', location);
            setAddress(location);
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
        var latLng = L.latLng(location.feature.geometry.y, location.feature.geometry.x);
        exploreLatLng = [location.feature.geometry.y, location.feature.geometry.x];
        mapControl.setGeocodeMarker(latLng);
        $('div.address > h4').html(MapTemplates.addressText(location.feature.attributes));
    }

    function setDestinationSidebar(destinations) {
        destinationsCache = destinations;
        var $container = $('<div></div>').addClass('destinations');
        $.each(destinations, function (i, destination) {
            var $destination = $(MapTemplates.destinationBlock(destination));

            $destination.click(function () {
                setDestinationSidebarDetail(destination);
                events.trigger(eventNames.destinationSelected, destination);
            });
            $container.append($destination);
        });
        $(options.selectors.sidebarDetails).empty().append($container);
        $(options.selectors.sidebarContainer).height(400);
    }

    function setDestinationSidebarDetail(destination) {
        var $detail = $(MapTemplates.destinationDetail(destination));
        $detail.find('.back').on('click', onDestinationDetailBackClicked);
        $detail.find('.getdirections').on('click', function() {
            events.trigger(eventNames.destinationDirections, destination);
        });
        $(options.selectors.sidebarDetails).empty().append($detail);
    }

    function onDestinationDetailBackClicked() {
        setDestinationSidebar(destinationsCache);
    }

    function setFromUserPreferences() {
        var method = UserPreferences.getPreference('method');
        if (method === 'explore') {
            var mode = UserPreferences.getPreference('mode');

            // 'explore' tab
            var exploreOrigin = UserPreferences.getPreference('origin');
            exploreLatLng = [exploreOrigin.feature.geometry.y,
                                        exploreOrigin.feature.geometry.x];
            var originText = UserPreferences.getPreference('originText');
            var exploreTime = UserPreferences.getPreference('exploreTime');
            setAddress(exploreOrigin);

            $(options.selectors.exploreOrigin).typeahead('val', originText);
            $(options.selectors.exploreTime).val(exploreTime);
            $(options.selectors.modeSelector).val(mode);

            // use current date/time when loading from preferences
            var when = moment();
            fetchIsochrone(when, mode, exploreTime);
        }
    }

})(jQuery, CAC.Map.Templates, CAC.Search.Typeahead, CAC.User.Preferences);
