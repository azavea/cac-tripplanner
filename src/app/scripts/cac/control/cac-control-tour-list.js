/**
 *  View control for the tour overview destinations list
 *
 */
CAC.Control.TourList = (function (_, $, MapTemplates, Utils) {

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
            container: '.tours',
            dataPlaceIndex: 'data-tour-place-index',
            hiddenClass: 'hidden',
            destinationList: '.tour-list',
            destinationItem: '.place-card',
            destinationDirectionsButton: '.place-card-action-directions',
            removeButton: '.place-card-remove',
            undoButton: '.tour-heading i'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        destinationClicked: 'cac:control:tourlist:destinationclicked',
        destinationHovered: 'cac:control:tourlist:destinationhovered',
        destinationsReordered: 'cac:control:tourlist:destinationsreordered'
    };

    var $container = null;
    var destinations = [];
    var tourId = null;

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

    function setTourDestinations(tour) {
        if (tour && tour.id !== tourId) {
            tourId = tour.id;
            destinations = tour.destinations;
        } else {
            // tour unchanged; preserve user assigned destination order
            tour.destinations = destinations;
        }

        // Show the directions div and populate with tour destinations

        // Only show button to remove a place from the list if it is in a reorderable tour
        // still containing at least three destinations.
        var canRemove = tour && tour.is_tour && _.reduce(tour.destinations, function(ct, dest) {
            // only count destinations the user has not removed
            return dest.removed ? ct : ct + 1;
        }, 0) > 2;
        var html = MapTemplates.tourDestinationList(tour, canRemove);
        $container.html(html);

        $(options.selectors.destinationDirectionsButton).on('click', onTourDestinationClicked);
        $(options.selectors.destinationItem).on('mouseenter', onTourDestinationHovered);
        $(options.selectors.destinationItem).on('mouseleave', onTourDestinationHoveredOut);
        $(options.selectors.removeButton).on('click', onRemoveButtonClick);
        $(options.selectors.undoButton).on('click', onUndoButtonClick);

        var $destinationList = $(options.selectors.destinationList);

        // First remove sortable if already initialized
        if ($destinationList.sortable('widget')) {
            $destinationList.sortable('destroy');
        }

        // Set up sortable list for tours (not events)
        if (tour.is_tour) {
            var $sortableList = $destinationList.sortable({
                animation: 150,
                direction: 'vertical',
                draggable: options.selectors.destinationItem,
                // Allow scrolling while dragging by not using native HTML5
                // See: https://github.com/SortableJS/Sortable/issues/935
                forceFallback: true,
                handle: '.place-card-drag-handle',
                sort: true,
                onUpdate: onDestinationListReordered
            });
        }

        enableCarousel();
    }

    // Called when Sortable list of destinations gets updated
    function onDestinationListReordered(e) {
        var kids = e.to.children;
        // First list item is the header; skip it
        for (var i = 1; i < kids.length; i++) {
            var k = kids[i];
            var originalIndex = k.getAttribute(options.selectors.dataPlaceIndex);
            // assign property with new order
            destinations[originalIndex].userOrder = i;
        }

        destinations = _.sortBy(destinations, 'userOrder');
        reorderDestinations();
    }

    /**
     * Enable carousel for swiping tour destinations on mobile
     */
    function enableCarousel() {
        if (!destinations || destinations.length < 1) {
            return;
        }

        var slider = tns(Object.assign({
            container: options.selectors.destinationList,
        }, Utils.defaultCarouselOptions, {
            autoplay: false,
            autoHeight: true,
            loop: false,
            responsive: {
                320: {disable: false, controls: false, nav: true, autoHeight: true},
                481: {disable: true}
            }
        }));

        // Highlight place on map on destinations carousel swipe
        slider.events.on('indexChanged', function(info) {
            var items = $(options.selectors.destinationItem);
            if (items && items.length > info.displayIndex) {
                items.eq(info.displayIndex).triggerHandler('mouseenter');
            }
        });
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
     * Handle click event on destination list item, this is set to element clicked
     */
    function onTourDestinationClicked(event) {
        event.preventDefault();
        var index = this.getAttribute(options.selectors.dataPlaceIndex);
        var destination = destinations[index];
        var placeId = 'place_' + destination.id;
        events.trigger(eventNames.destinationClicked, [placeId,
                                                       destination.address,
                                                       destination.location.x,
                                                       destination.location.y]);
    }

    /**
     * Handle hover event on destination list item
     */
    function onTourDestinationHovered(e) {
        var index = this.getAttribute(options.selectors.dataPlaceIndex);
        var destination = destinations[index];
        events.trigger(eventNames.destinationHovered, destination);
        e.stopPropagation();
    }

    function onTourDestinationHoveredOut(e) {
        events.trigger(eventNames.destinationHovered, null);
        e.stopPropagation();
    }

    // Helper to filter user-removed destinations before triggering reorder
    function reorderDestinations() {
        var showDestinations = _.filter(destinations, function(destination) {
            return !destination.removed;
        });
        events.trigger(eventNames.destinationsReordered, [showDestinations]);
    }

    /**
     * Handle remove button click on card.
     */
    function onRemoveButtonClick(e) {
        var $placeCard = $(e.target).closest(options.selectors.destinationItem);
        var index = $placeCard.data('tour-place-index');
        destinations[index].removed = true;
        reorderDestinations();
    }

    /**
     * Handle undo icon button click by resetting destination order to default (admin-assigned).
     */
     function onUndoButtonClick(e) {
         var needsReordering = false;
        _.each(destinations, function(destination) {
            if (destination.removed || (!_.isUndefined(destination.userOrder) &&
                destination.userOrder !== destination.order)) {
                needsReordering = true;
            }
            destination.userOrder = destination.order;
            destination.removed = false;
        });

        if (needsReordering) {
            destinations = _.sortBy(destinations, 'order');
            reorderDestinations();
        }
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
})(_, jQuery, CAC.Map.Templates, CAC.Utils);
