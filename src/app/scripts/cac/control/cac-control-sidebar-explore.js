
/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.SidebarExplore = (function ($, MapTemplates, UserPreferences) {

    'use strict';

    var defaults = {};
    var options = {};

    var events = $({});
    var eventNames = {
        destinationSelected: 'cac:control:sidebarexplore:destinationselected'
    };

    var mapControl = null;

    function SidebarExploreControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;

        $('.sidebar-options .view-more').click(showOptions);

        // Show isochrone in discovery tab
        $('section.explore button[type=submit]').click(clickedExplore);

        $('.sidebar-search button[type="submit"]').on('click', function(){
            $('.explore').addClass('show-results');
        });

        setFromUserPrefs();
    }

    SidebarExploreControl.prototype = {
        events: events,
        setAddress: setAddress,
        setDestinationSidebar: setDestinationSidebar
    };

    return SidebarExploreControl;

    /**
     * Set user preferences before fetching isochrone.
     */
    function clickedExplore() {
        var exploreMinutes = $('#exploreTime').val();
        var mode = $('#exploreModeSelector').val();

        // TODO: add date/time selector to 'explore' extra options panel?
        var when = moment();

        // store search inputs to preferences
        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('originText', $('#exploreOrigin').val());
        UserPreferences.setPreference('exploreTime', exploreMinutes);
        UserPreferences.setPreference('mode', mode);

        fetchIsochrone(when, mode, exploreMinutes);
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
        mapControl.fetchIsochrone(directions.exploreOrigin, when, mode, exploreMinutes).then(
            function (destinations) {
                setDestinationSidebar(destinations);
            }
        );
    }

    function showOptions(event) {
        var parent = $(event.target).closest('section');
        var moreOpt = $('.sidebar-options .more-options', parent);

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
        mapControl.setGeocodeMarker(latLng);
        $('div.address > h4').html(MapTemplates.addressText(location.feature.attributes));
    }

    function setDestinationSidebar(destinations) {
        var $container = $('<div></div>').addClass('destinations');
        $.each(destinations, function (i, destination) {
            var $destination = $(MapTemplates.destinationBlock(destination));

            $destination.click(function () {
                events.trigger(eventNames.destinationSelected, destination);
            });
            $container.append($destination);
        });
        $('.explore div.sidebar-details').empty().append($container);
        $('.explore .sidebar-clip').height(400);
    }

    function setFromUserPrefs() {
        var method = UserPreferences.getPreference('method');
        if (!method) {
            return; // no user preferences set
        }
        var mode = UserPreferences.getPreference('mode');

        // 'explore' tab
        var exploreOrigin = UserPreferences.getPreference('origin');
        directions.exploreOrigin = [exploreOrigin.feature.geometry.y,
                                    exploreOrigin.feature.geometry.x];
        var originText = UserPreferences.getPreference('originText');
        var exploreTime = UserPreferences.getPreference('exploreTime');
        setAddress(exploreOrigin);

        $('#exploreOrigin').typeahead('val', originText);
        $('#exploreTime').val(exploreTime);
        $('#exploreModeSelector').val(mode);

        var when = moment(); // TODO: add date/time selector for 'explore' options?

        fetchIsochrone(when, mode, exploreTime);
    }

})(jQuery, CAC.Map.Templates, CAC.User.Preferences);
