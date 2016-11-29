CAC.Control.Modal = (function ($) {
    'use strict';

    var defaults = {
        // Class name to search the DOM for to attach the modal control to. Required.
        modalClass: null,
        selectors: {
            body: '#body-div',
            buttonClose: '.btn-close-modal',
            buttonClear: '.btn-reset-modal',
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
        this.clear = _clear.bind(this);

        // bind events; these must also be unbound during _close
        $(this.options.selectors.modal + ' ' + this.options.modalSelector + ' ' +
            this.options.selectors.clickHandlerFilter).on('click',
            this.options.clickHandler);
        $(this.options.selectors.modal + ' ' + this.options.modalSelector + ' ' +
            this.options.selectors.buttonClose).on('click',
            this.close);
        $(this.options.selectors.modal + ' ' + this.options.modalSelector + ' ' +
            this.options.selectors.buttonClear).on('click',
            this.clear);
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

        // remove click handlers. otherwise will trigger click events repeatedly
        // on subsequent modal open
        $(this.options.selectors.modal + ' ' + this.options.modalSelector + ' ' +
            this.options.selectors.clickHandlerFilter).off('click');
        $(this.options.selectors.modal + ' ' + this.options.modalSelector + ' ' +
            this.options.selectors.buttonClose).off('click');
        $(this.options.selectors.modal + ' ' + this.options.modalSelector + ' ' +
            this.options.selectors.buttonClear).off('clear');

        if (this.options.onClose) {
            return this.options.onClose(event);
        }
    }

    function _clear(event) {
        if (this.options.clearHandler) {
            return this.options.clearHandler(event);
        }
    }

    function _getBodyClass(modal) {
        return 'body-modal body-' + modal.options.bodyModalClass;
    }

})(jQuery);
