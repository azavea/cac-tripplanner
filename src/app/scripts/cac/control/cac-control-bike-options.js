CAC.Control.BikeOptions = (function ($) {
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
        }
    };

    function BikeOptionsControl(params) {
        this.options = $.extend({}, defaults, params);
    }

    BikeOptionsControl.prototype = {
        changeMode: changeMode
    };

    return BikeOptionsControl;

    /**
     * Show/hide sidebar options based on the selected mode.
     * Expects both tabs to have the same selector names for the toggleable divs.
     */
    function changeMode(selectors, mode) {
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

})(jQuery);
