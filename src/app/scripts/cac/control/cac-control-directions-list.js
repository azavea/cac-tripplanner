
/**
 *  View control for the sidebar directions list
 *
 */
CAC.Control.DirectionsList = (function ($, Handlebars) {

    'use strict';

    var defaults = {
        // Should the back button be shown in the control
        //  this is weird, ideally we would handle the back button in the wrapper view, but we
        //  need to switch out the sidebar div as a whole
        showBackButton: false,
        // Should the share button be shown in the control
        showShareButton: false,
        selectors: {
            container: '.directions-list'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        backButtonClicked: 'cac:control:directionslist:backbutton',
        listItemClicked: 'cac:control:directionslist:listitem'
    };

    var $container = null;
    var itinerary = {};

    function DirectionsListControl(params) {
        options = $.extend({}, defaults, params);

        $container = $(options.selectors.container);
    }

    DirectionsListControl.prototype = {
        events: events,
        setItinerary: setItinerary,
        show: show,
        hide: hide,
        toggle: toggle
    };

    return DirectionsListControl;

    /**
     * Set the directions list from an OTP itinerary object
     * @param {[object]} itinerary An open trip planner itinerary object, as returned from the plan endpoint
     */
    function setItinerary(newItinerary) {
        itinerary = newItinerary;

        var $html = $(getTemplate([]));
        $html.find('a.back').on('click', function (event) {
            events.trigger(eventNames.backButtonClicked);
        });
        $container.empty().append($html);
    }

    function getTemplate(steps) {
        var source = [
            '<div class="row">',
                '<div class="col-xs-6">',
                    '<a class="back">Back</a>',
                '</div>',
                '<div class="col-xs-6">',
                    '<a class="share">Share</a>',
                '</div>',
            '</div>',
            '{{#each steps}}',
            '<div class="block block-step">',
            '</div>',
            '{{/each}}',
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({stesp: steps});
        return html;
    }

    function show() {
        $container.removeClass('hidden');
    }

    function hide() {
        $container.addClass('hidden');
    }

    function toggle() {
        if ($container.hasClass('hidden')) {
            show()
        } else {
            hide();
        }
    }
})(jQuery, Handlebars);