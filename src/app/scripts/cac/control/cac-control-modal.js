CAC.Control.Modal = (function ($) {
    'use strict';

    var defaults = {
        // Class name to search the DOM for to attach the modal control to. Required.
        modalClass: null,
        selectors: {
            body: '#body-div',
            buttonClose: '.btn-close-modal',
            clickHandlerFilter: 'li',
            modal: '.modal-overlay'
        },
        // Triggered directly by jQuery when a list item in the modal is clicked. NOOP by default.
        /*jshint unused:false*/
        clickHandler: function (event) { }
    };

    function Modal(params) {
        var options = $.extend({}, defaults, params);
        this.options = options;
        this.initialize();
    }

    Modal.prototype = {
        initialize: initialize,
    };

    return Modal;

    function initialize() {
        if (!this.options.modalSelector || !this.options.bodyModalClass) {
            throw 'CAC.Control.Modal options.modalSelector and options.bodyModalClass required.';
        }

        this.open = _open.bind(this);
        this.close = _close.bind(this);

        $(this.options.selectors.modal + ' ' + this.options.modalSelector).on('click',
            this.options.selectors.clickHandlerFilter, this.options.clickHandler);
        $(this.options.selectors.modal + ' ' + this.options.modalSelector).on('click',
            this.options.selectors.buttonClose, this.close);
    }

    function _open(event) {
        $(this.options.selectors.body).addClass(_getBodyClass(this));
        if (event && event.preventDefault) {
            event.preventDefault();
        }
        if (this.options.onOpen) {
            return this.options.onOpen(event);
        }
    }

    function _close(event) {
        $(this.options.selectors.body).removeClass(_getBodyClass(this));
        if (event && event.preventDefault) {
            event.preventDefault();
        }
        if (this.options.onClose) {
            return this.options.onClose(event);
        }
    }

    function _getBodyClass(modal) {
        return 'body-modal body-' + modal.options.bodyModalClass;
    }

})(jQuery);
