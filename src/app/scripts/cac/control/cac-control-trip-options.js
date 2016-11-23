CAC.Control.TripOptions = (function ($, Modal) {
    'use strict';

    var defaults = {
        currentMode: 'WALK',
        selectors: {
            bodyModalClass: 'modal-options',
            visibleClass: 'visible',
            bikeOptionsModal: '.modal-options.bike-options',
            bikeShareSelectionModal: '.modal-options.bike-share-select',
            timingModal: '.modal-options.timing-modal',
            bikeTriangleModal: '.modal-options.bike-triangle',
            walkOptionsModal: '.modal-options.walk-options',
            accessibilityModal: '.modal-options.accessibility-options',
        }
    };
    var events = $({});
    var eventNames = {
        toggle: 'cac:control:tripoptions:toggle'
    };
    var options = {};
    var modal = null;
    var modalSelector = null;

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
        modalSelector = options.currentMode.indexOf('BICYCLE') > -1 ?
            options.selectors.bikeOptionsModal :
            options.selectors.walkOptionsModal;

        modal = new Modal({
            modalSelector: modalSelector,
            bodyModalClass: options.selectors.bodyModalClass,
            clickHandler: onClick,
            onClose: onClose
        });
    }

    function onClick() {
        console.log('TODO: implement click');
    }

    function onClose() {
        $(modalSelector).removeClass(options.selectors.visibleClass);
        console.log('TODO: implement close');
    }

    function open() {
        $(modalSelector).addClass(options.selectors.visibleClass);
        modal.open();
    }

})(jQuery, CAC.Control.Modal);
