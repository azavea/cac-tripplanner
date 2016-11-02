CAC.Control.BikeModeOptions = (function ($) {
    'use strict';

    var defaults = {
        // Note:  the three bike options must sum to 1, or OTP won't plan the trip
        bikeTriangle: {
            neutral: {
                triangleSafetyFactor: 0.34,
                triangleSlopeFactor: 0.33,
                triangleTimeFactor: 0.33
            },
            flatter: {
                triangleSafetyFactor: 0.17,
                triangleSlopeFactor: 0.66,
                triangleTimeFactor: 0.17
            },
            faster: {
                triangleSafetyFactor: 0.17,
                triangleSlopeFactor: 0.17,
                triangleTimeFactor: 0.66
            },
            safer: {
                triangleSafetyFactor: 0.66,
                triangleSlopeFactor: 0.17,
                triangleTimeFactor: 0.17
            }
        },
        defaultMode: 'WALK,TRANSIT',
        // map button class names to OpenTripPlanner mode parameters
        modes: {
            walk: 'WALK',
            bike: 'BICYCLE',
            transit: 'TRANSIT'
        }
    };

    var options = {};

    function BikeModeOptionsControl(params) {
        options = $.extend({}, defaults, params);
        this.options = options;
    }

    BikeModeOptionsControl.prototype = {
        changeMode: changeMode,
        getMode: getMode,
        setMode: setMode
    };

    return BikeModeOptionsControl;

    /**
     * Show/hide sidebar options based on the selected mode.
     * Expects both tabs to have the same selector names for the toggleable divs.
     */
    function changeMode(selectors) {
        var mode = getMode(selectors.modeSelectors);
        if (mode && mode.indexOf('BICYCLE') > -1) {
            $(selectors.bikeTriangleDiv).removeClass('hidden');
            $(selectors.maxWalkDiv).addClass('hidden');
            $(selectors.wheelchairDiv).addClass('hidden');
        } else {
            $(selectors.bikeTriangleDiv).addClass('hidden');
            $(selectors.maxWalkDiv).removeClass('hidden');
            $(selectors.wheelchairDiv).removeClass('hidden');
        }
    }

    /**
     * Helper to return the mode string based on the buttons within the given input selector.
     *
     * @param modeSelectors {String} jQuery selector like '#someId input'
     * @returns {String} comma-separated list of OpenTripPlanner mode parameters
     */
    function getMode(modeSelectors) {
        var $selected = $(modeSelectors);
        if (!$selected) {
            console.error('no mode controls found');
            return options.defaultMode;
        }
        var mode = _(options.modes).filter(function(val, key) {
            return $selected.hasClass(key);
        }).join(',');
        return mode || options.defaultMode;
    }

    /**
     * Helper to set the appropriate buttons within the given input selector
     * so that they match the mode string.
     *
     * @param modeSelectors {String} jQuery selector like '.mode-class'
     * @param mode {String} OpenTripPlanner mode string like 'WALK,TRANSIT'
     */
    function setMode(modeSelectors, mode) {

        var radioSelector = modeSelectors + options.modes.walkBike;
        var transitSelector = modeSelectors + options.modes.transit;

        var walkBikeVal = $(radioSelector + ':checked').val();
        var haveTransit = $(transitSelector + ':checked').val();

        // toggle transit button selection, if needed
        // NB: cannot just .click() button here, or wind up in inconsistent state,
        // particularly on page load.
        if (mode.indexOf('TRANSIT') > -1 && !haveTransit) {
            $(transitSelector).prop('checked', true);
            $(transitSelector).parents('label').addClass('active');
        } else if (mode.indexOf('TRANSIT') === -1 && haveTransit) {
            $(transitSelector).prop('checked', false);
            $(transitSelector).parents('label').removeClass('active');
        }

        // switch walk/bike selection, if needed
        var $bikeButton = $(radioSelector + '[value=BICYCLE]');
        var $walkButton = $(radioSelector + '[value=WALK]');
        if (mode.indexOf('BICYCLE') > -1 && walkBikeVal !== 'BICYCLE') {
            $bikeButton.prop('checked', true);
            $bikeButton.parents('label').addClass('active');
            $walkButton.prop('checked', false);
            $walkButton.parents('label').removeClass('active');
        } else if (mode.indexOf('BICYCLE') === -1 && walkBikeVal !== 'WALK') {
            $walkButton.prop('checked', true);
            $walkButton.parents('label').addClass('active');
            $bikeButton.prop('checked', false);
            $bikeButton.parents('label').removeClass('active');
        }
    }

})(jQuery);
