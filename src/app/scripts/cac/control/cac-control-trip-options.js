CAC.Control.TripOptions = (function ($, Modal) {
    'use strict';

    var defaults = {
        currentMode: 'WALK',
        selectors: {
            bodyModalClass: 'modal-options',
            selectedClass: 'selected', // used to mark selection from a list
            visibleClass: 'visible',
            listOptions: 'li.modal-list-choice',

            bikeOptionsModal: '.modal-options.bike-options',
            walkOptionsModal: '.modal-options.walk-options',

            // mapping of menu option classes to the selector for the next modal to open
            bikeMenuOptions: {
                'modal-list-indego': '.modal-options.bike-share-select',
                'modal-list-timing': '.modal-options.timing-modal',
                'modal-list-ride': '.modal-options.bike-triangle'
            },

            walkMenuOptions: {
                'modal-list-timing': '.modal-options.timing-modal',
                'modal-list-accessibility': '.modal-options.accessibility-options'
            }
        }
    };
    var events = $({});
    var eventNames = {
        toggle: 'cac:control:tripoptions:toggle'
    };
    var options = {};
    var isBike = false; // in walk mode if false
    var modal = null;
    var modalSelector = null;
    var childModal = null;
    var childModalSelector = null;

    function TripOptionsControl(params) {
        options = $.extend({}, defaults, params);
        this.initialize();
    }

    TripOptionsControl.prototype = {
        initialize: initialize,
        events: events,
        eventNames: eventNames,
        open: open
    };

    return TripOptionsControl;

    function initialize() {
        if (options.currentMode.indexOf('BICYCLE') > -1) {
            modalSelector = options.selectors.bikeOptionsModal;
            isBike = true;
        } else {
            modalSelector = options.selectors.walkOptionsModal;
            isBike = false;
        }

        modal = new Modal({
            modalSelector: modalSelector,
            bodyModalClass: options.selectors.bodyModalClass,
            clickHandler: onClick,
            onClose: onClose
        });
    }

    function onClick(e) {
        var $el = $(e.target);

        var menuOptions = isBike ? options.selectors.bikeMenuOptions : options.selectors.walkMenuOptions;

        childModalSelector = _.find(menuOptions, function(option, key) {
            return $el.hasClass(key);
        });

        if (childModalSelector) {
            childModal = new Modal({
                modalSelector: childModalSelector,
                bodyModalClass: options.selectors.bodyModalClass,
                clickHandler: childModalClick,
                onClose: onChildModalClose
            });
            modal.close();
            childModal.open();
            $(childModalSelector).addClass(options.selectors.visibleClass);
        } else {
            console.error('could not find child menu for selected option');
        }
    }

    function onClose() {
        $(modalSelector).removeClass(options.selectors.visibleClass);
        console.log('TODO: implement close of parent modal');
        // TODO: should trigger re-query (also check if anything actually changed first?)
    }

    /**
     * Public function to pass through calls to open the top-level modal
     */
    function open() {
        $(modalSelector).addClass(options.selectors.visibleClass);
        modal.open();
    }

    function childModalClick(e) {
        console.log('TODO: implement click on child modal');
        var $el = $(e.target);

        // toggle selected class to clicked item
        // TODO: modify to only do this if a list item clicked
        $(childModalSelector).find(options.selectors.listOptions)
            .removeClass(options.selectors.selectedClass);

        $el.addClass(options.selectors.selectedClass);

        childModal.close();
    }

    function onChildModalClose() {
        $(childModalSelector).removeClass(options.selectors.visibleClass);
        childModal = null;
        childModalSelector = null;
    }

})(jQuery, CAC.Control.Modal);
