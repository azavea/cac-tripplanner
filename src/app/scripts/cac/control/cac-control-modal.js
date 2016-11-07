CAC.Control.Modal = (function ($) {
    'use strict';

    var defaults = {
        // Class to search the DOM for to attach this modal to. Required.
        modalClass: null,
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

        $('.modal-overlay .' + options.modalClass).on('click', 'li', options.clickHandler);
        $('.modal-overlay .' + options.modalClass).on('click', '.btn-close-modal', close);
    }

    function open(event) {
        var bodyModalClass = 'body-' + options.modalClass;
        $('body').addClass('body-modal ' + bodyModalClass);
        if (event && event.preventDefault) {
            event.preventDefault();
        }
    }

    function close(event) {
        var bodyModalClass = 'body-' + options.modalClass;
        $('body').removeClass('body-modal ' + bodyModalClass);
        if (event && event.preventDefault) {
            event.preventDefault();
        }
    }

})(jQuery);
