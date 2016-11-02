CAC.Control.ModeOptions = (function ($) {
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
        },
        selectors: {
            // mode related selectors
            modeToggle: '.mode-toggle',
            modeOption: '.mode-option',
            modePicker: '.mode-picker', // parent to modeOption
            onClass: 'on',
            offClass: 'off',
            selectedModes: '.mode-option.on',
            transitIconOnOffClasses: 'icon-transit-on icon-transit-off',
            transitModeOption: '.mode-option.transit'
        }
    };

    var options = {};

    function ModeOptionsControl(params) {
        options = $.extend({}, defaults, params);
        this.options = options;
        this.initialize();
    }

    ModeOptionsControl.prototype = {
        initialize: initialize,
        changeMode: changeMode,
        getMode: getMode,
        setMode: setMode
    };

    return ModeOptionsControl;

    function initialize() {
        console.log('initialize mode buttons');
        // handle mode toggle buttons
        // TODO: check which option before toggle
        $(options.selectors.modeToggle).on('click', options.selectors.modeOption, function(e) {
            $(this).toggleClass(options.selectors.onClass)
                .siblings(options.selectors.modeOption).toggleClass(options.selectors.onClass);
            e.preventDefault();
        });

        $(options.selectors.transitModeOption).on('click', function(e) {
            $(this).toggleClass(options.selectors.onClass + ' ' + options.selectors.offClass)
                .find('i').toggleClass(options.selectors.transitIconOnOffClasses);
            e.preventDefault();
        });
    }

    /**
     * Show/hide sidebar options based on the selected mode.
     * Expects both tabs to have the same selector names for the toggleable divs.
     */
    function changeMode() {
        var mode = getMode();
        if (mode && mode.indexOf('BICYCLE') > -1) {
            $(options.selectors.bikeTriangleDiv).removeClass('hidden');
            $(options.selectors.maxWalkDiv).addClass('hidden');
            $(options.selectors.wheelchairDiv).addClass('hidden');
        } else {
            $(options.selectors.bikeTriangleDiv).addClass('hidden');
            $(options.selectors.maxWalkDiv).removeClass('hidden');
            $(options.selectors.wheelchairDiv).removeClass('hidden');
        }
    }

    /**
     * Helper to return the mode string based on the buttons within the given input selector.
     *
     * @returns {String} comma-separated list of OpenTripPlanner mode parameters
     */
    function getMode() {
        var $selected = $(options.selectors.selectedModes);
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
     * @param mode {String} OpenTripPlanner mode string like 'WALK,TRANSIT'
     */
    function setMode(mode) {

        console.log('set mode');

        // TODO: move out selectors from here

        var $modes = $(options.selectors.modePicker);
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
