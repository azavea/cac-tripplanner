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
            modalBackground: '.modal-overlay',
            modal: '.modal-panel'
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
        this.backgroundClick = _backgroundClick.bind(this);

        // build selectors for children
        this.options.selectors.modalOption = getChildSelector('clickHandlerFilter', this.options);
        this.options.selectors.modalCloseButton = getChildSelector('buttonClose', this.options);
        this.options.selectors.modalClearButton = getChildSelector('buttonClear', this.options);
    }

    function _open(event) {
        $(this.options.selectors.body).addClass(this.options.bodyModalClass);
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        // unbind events before potentially re-binding them
        $(this.options.selectors.modalOption).off('click');
        $(this.options.selectors.modalCloseButton).off('click');
        $(this.options.selectors.modalClearButton).off('click');
        $(this.options.selectors.modalBackground).off('click');

        // bind events; these must also be unbound during _close
        $(this.options.selectors.modalOption).on('click', this.options.clickHandler);
        $(this.options.selectors.modalCloseButton).on('click', this.close);
        $(this.options.selectors.modalClearButton).on('click', this.clear);
        $(this.options.selectors.modalBackground).on('click', this.backgroundClick);

        if (this.options.onOpen) {
            return this.options.onOpen(event);
        }
    }

    function _backgroundClick(event) {
        event.stopPropagation();
        // listen only to background and not modal within it
        if ($(event.target).has(this.options.selectors.modal).length) {
            this.close(event, true);
        }
    }

    function _close(event, immediately) {
        $(this.options.selectors.body).removeClass(this.options.bodyModalClass);
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        if (this.options.onClose) {
            return this.options.onClose(event, immediately);
        }
    }

    function _clear(event) {
        if (this.options.clearHandler) {
            return this.options.clearHandler(event);
        }
    }

    /**
     * Helper to build a selector for elements within the modal.
     *
     * @param {String} selector Key to child selector; must exist in options.selectors
     * @returns {String} jQuery selector specifying parent and child
     */
    function getChildSelector(selector, options) {
        return [
            options.selectors.modalBackground,
            options.modalSelector,
            options.selectors[selector]
        ].join(' ');
    }

})(jQuery);
