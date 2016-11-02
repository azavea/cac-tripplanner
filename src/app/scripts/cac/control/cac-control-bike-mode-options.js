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
            console.error('no mode controls found to read');
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

        // TODO: move out selectors from here

        var $modes = $(modeSelectors);
        if (!$modes) {
            console.error('no mode controls found to set');
            return;
        }

        _.each(options.modes, function(val, key) {
            var $thisMode = $modes.find('.' + key);

            var addClass = 'off';
            var removeClass = 'on';
            if (mode.indexOf(val) > -1) {
                addClass = 'on';
                removeClass = 'off';
            }

            $thisMode.addClass(addClass);
            $thisMode.removeClass(removeClass);

            if (key === 'transit') {
                var $modeIcon = $thisMode.find('i');
                $modeIcon.addClass('icon-transit-' + addClass);
                $modeIcon.removeClass('icon-transit-' + removeClass);
            }
        });
    }

})(jQuery);
