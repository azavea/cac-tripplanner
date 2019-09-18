/**
 *  View control for the tour overview destinations list
 *
 */
CAC.Control.TourList = (function (_, $, MapTemplates) {

    'use strict';

    var defaults = {
        // Should the back button be shown in the control
        //  this is weird, ideally we would handle the back button in the wrapper view, but we
        //  need to switch out the sidebar div as a whole
        showBackButton: false,
        // Should the share button be shown in the control
        showShareButton: false,
        selectors: {
            alert: '.alert',
            container: '.directions-list',
            hiddenClass: 'hidden',
            destinationList: '.tour-destinations-list',
            destinationItem: '.route-summary'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        destinationClicked: 'cac:control:tourlist:destinationclicked',
        destinationHover: 'cac:control:tourlist:destinationhover'
    };

    var $container = null;
    var destinations = [];

    function TourListControl(params) {
        options = $.extend({}, defaults, params);
        $container = $(options.selectors.container);
    }

    TourListControl.prototype = {
        events: events,
        eventNames: eventNames,
        setTourDestinations: setTourDestinations,
        setTourDestinationsError: setTourDestinationsError,
        showTourDestinations: showTourDestinations,
        show: show,
        hide: hide,
        toggle: toggle
    };

    return TourListControl;

    function setTourDestinations(newDestinations) {
        destinations = newDestinations;

        // Show the directions div and populate with tour destinations
        var html = MapTemplates.tourDestinationList(destinations);
        $container.html(html);

        enableCarousel(destinations);

        $(options.selectors.tourItem).on('click', onTourDestinationClicked);
        $(options.selectors.tourItem).hover(onTourDestinationHover);
    }

    /**
     * Use in case OTP planner returns an error
     * @param {Object} Error object returned from OTP
     */
    function setTourDestinationsError(error) {

        // default message; will use in case OTP unresponsive
        var msg = 'Cannot currently plan trip. Please try again later.';

        // If OTP responded with an error, use its message
        if (error && error.msg) {
            msg = error.msg;
            // override default error message for out-of-bounds or non-navigable orign/destination
            if (msg.indexOf('Your start or end point might not be safely accessible') > -1) {
                msg = 'Make sure the origin and destination are accessible addresses within ' +
                      'the Greater Philadelphia area.';
            }
        }

        var alert = MapTemplates.alert(msg, 'Could not plan trip', 'danger');
        $container.html(alert);

        // handle alert close button click
        $container.one('click', options.selectors.alert, function() {
            $(options.selectors.alert).remove();
        });
    }

    /**
     * Enable carousel for swiping destinations on mobile
     */
    function enableCarousel(destinations) {
        if (destinations.length < 2) {
            return;
        }

        var slider = tns({
            container: options.selectors.tourList,
            autoplayButton: false,
            autoplayButtonOutput: false,
            autoplayPosition: 'top',
            controls: false,
            controlPosition: 'bottom',
            items: 1,
            nav: true,
            navPosition: 'bottom',
            slideBy: 'page',
            autoplay: false,
            autoHeight: true,
            responsive: {
                320: {disable: false, controls: false, nav: true, autoHeight: true},
                481: {disable: true}
            }
        });

        // Highlight route on map on destination carousel swipe
        slider.events.on('indexChanged', function(info) {
            var items = $(options.selectors.tourItem);
            if (items && items.length > info.displayIndex) {
                items.eq(info.displayIndex).triggerHandler('mouseenter');
            }
        });
    }

    function getDestinationById(id) {
        return destinations[id];
    }

    /**
     * Handle click event on destination list item, this is set to element clicked
     */
    function onDestinationClicked() {
        var destinationId = this.getAttribute('data-destination-id');
        var destination = getDestinationById(destinationId);
        events.trigger(eventNames.destinationClicked, destination);
    }

    /**
     * Handle hover event on destination list item
     */
    function onDestinationHover() {
        var destinationId = this.getAttribute('data-destination-id');
        var destination = getDestinationById(destinationId);
        events.trigger(eventNames.destinationHover, destination);
    }

    function show() {
        $container.removeClass(options.selectors.hiddenClass);
    }

    /**
     * Show/hide all destinations
     *
     * @param {Boolean} show If false, will make all Destinations transparent (hide them)
     */
    function showTourDestinations(show) {
        _.forEach(destinations, function(destination) {
            destination.show(show);
        });
    }

    function hide() {
        $container.addClass(options.selectors.hiddenClass);
    }

    function toggle() {
        if ($container.hasClass(options.selectors.hiddenClass)) {
            show();
        } else {
            hide();
        }
    }
})(_, jQuery, CAC.Map.Templates);
