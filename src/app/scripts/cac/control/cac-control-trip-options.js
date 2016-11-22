CAC.Control.TripOptions = (function ($, Modal) {
    'use strict';

    var defaults = {
        currentMode: 'WALK',
        selectors: {
            // mode related selectors
            modeToggle: '.mode-toggle',

        }
    };
    var events = $({});
    var eventNames = {
        toggle: 'cac:control:tripoptions:toggle'
    };
    var options = {};

    function TripOptionsControl(params) {
        options = $.extend({}, defaults, params);
        this.initialize();
    }

    TripOptionsControl.prototype = {
        initialize: initialize,
        changeMode: changeMode,
        events: events,
        eventNames: eventNames,
        getMode: getMode,
        setMode: setMode
    };

    return TripOptionsControl;

    function initialize() {
        if (options.currentMode === 'BICYCLE') {

        } else {
            // walking
        }
    }

    /**
     * Show/hide sidebar options based on the selected mode.
     * Expects both tabs to have the same selector names for the toggleable divs.
     */
    function changeMode() {

    }

    /**
     * Helper to return the mode string based on the buttons within the given input selector.
     *
     * @returns {String} comma-separated list of OpenTripPlanner mode parameters
     */
    function getMode() {

    }

    /**
     * Helper to set the appropriate buttons within the given input selector
     * so that they match the mode string.
     *
     * @param mode {String} OpenTripPlanner mode string like 'WALK,TRANSIT'
     */
    function setMode(mode) {

    }

})(jQuery, CAC.Control.Modal);
