CAC.Control.Modal = (function ($) {
    'use strict';

    var defaults = {
        // Class to search the DOM for to attach this modal to. Required.
        modalClass: null,
        selectors: {
            body: 'body',
            buttonClose: '.btn-close-modal',
            clickHandlerFilter: 'li',
            modal: '.modal-overlay'
        },
        // Triggered directly by jQuery when a list item in the modal is clicked. NOOP by default.
        clickHandler: function (event) { }
    };

    var options = {};

    function Modal(params) {
        options = $.extend({}, defaults, params);
        this.options = options;
        this.initialize();
    }

    Modal.prototype = {
        initialize: initialize,
        open: open,
        close: close
    };

    return Modal;

    function initialize() {
        if (!options.modalClass) {
            throw 'CAC.Control.Modal options.modalClass required.';
        }

        $(options.selectors.modal + ' .' + options.modalClass).on('click',
            options.selectors.clickHandlerFilter, options.clickHandler);
        $(options.selectors.modal + ' .' + options.modalClass).on('click',
            options.selectors.buttonClose, close);
    }

    function open(event) {
        var bodyModalClass = 'body-' + options.modalClass;
        $(options.selectors.body).addClass('body-modal ' + bodyModalClass);
        if (event && event.preventDefault) {
            event.preventDefault();
        }
    }

    function close(event) {
        var bodyModalClass = 'body-' + options.modalClass;
        $(options.selectors.body).removeClass('body-modal ' + bodyModalClass);
        if (event && event.preventDefault) {
            event.preventDefault();
        }
    }

})(jQuery);
