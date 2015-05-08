/**
 *  View control for the itinerary list
 *
 */
CAC.Control.ItineraryList = (function (_, $, MapTemplates) {

    'use strict';

    var defaults = {
        // Should the back button be shown in the control
        //  this is weird, ideally we would handle the back button in the wrapper view, but we
        //  need to switch out the sidebar div as a whole
        showBackButton: false,
        // Should the share button be shown in the control
        showShareButton: false,
        selectors: {
            container: '.itineraries'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        itineraryClicked: 'cac:control:itinerarylist:itineraryclicked',
        itineraryHover: 'cac:control:itinerarylist:itineraryhover'
    };

    var $container = null;
    var itineraries = [];

    function ItineraryListControl(params) {
        options = $.extend({}, defaults, params);

        $container = $(options.selectors.container);
    }

    ItineraryListControl.prototype = {
        events: events,
        eventNames: eventNames,
        setItineraries: setItineraries,
        setItinerariesError: setItinerariesError,
        showItineraries: showItineraries,
        show: show,
        hide: hide,
        toggle: toggle
    };

    return ItineraryListControl;

    /**
     * Set the directions list from an OTP itinerary object
     * @param {[object]} itinerary An open trip planner itinerary object, as returned from the plan endpoint
     */
    function setItineraries(newItineraries) {
        itineraries = newItineraries;


        // Show the directions div and populate with itineraries
        var html = MapTemplates.itineraryList(itineraries);
        $container.html(html);
        $('a.itinerary').on('click', onItineraryClicked);
        $('.block-itinerary').on('click', onItineraryClicked);
        $('a.itinerary').hover(onItineraryHover);
        $('.block-itinerary').hover(onItineraryHover);
    }

    /**
     * Use in case OTP planner returns an error
     * @param {Object} Error object returned from OTP
     */
    function setItinerariesError(error) {
        var $alert = MapTemplates.alert('Could not plan trip: ' + error.msg, 'danger');
        $container.html($alert);
    }

    function getItineraryById(id) {
        return itineraries[id];
    }

    /**
     * Handle click event on itinerary list item, this is set to element clicked
     */
    function onItineraryClicked() {
        var itineraryId = this.getAttribute('data-itinerary');
        var itinerary = getItineraryById(itineraryId);
        events.trigger(eventNames.itineraryClicked, itinerary);
    }

    /**
     * Handle hover event on itinerary list item
     */
    function onItineraryHover() {
        var itineraryId = this.getAttribute('data-itinerary');
        var itinerary = getItineraryById(itineraryId);
        events.trigger(eventNames.itineraryHover, itinerary);
    }

    function show() {
        $container.removeClass('hidden');
    }

    /**
     * Show/hide all itineraries
     *
     * @param {Boolean} show If false, will make all itineraries transparent (hide them)
     */
    function showItineraries(show) {
        for (var i in itineraries) {
            itineraries[i].show(show);
        }
    }

    function hide() {
        $container.addClass('hidden');
    }

    function toggle() {
        if ($container.hasClass('hidden')) {
            show();
        } else {
            hide();
        }
    }
})(_, jQuery, CAC.Map.Templates);
