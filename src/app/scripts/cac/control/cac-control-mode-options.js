CAC.Control.ModeOptions = (function ($) {
    'use strict';

    var defaults = {
        defaultMode: 'BICYCLE',
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
            transitIconClassPrefix: 'icon-transit-',
            transitIconOnClass: 'icon-transit-on',
            transitIconOnOffClasses: 'icon-transit-on icon-transit-off',
            transitModeOption: '.mode-option.transit'
        }
    };
    var events = $({});
    var eventNames = {
        toggle: 'cac:control:modeoptions:toggle'
    };
    var options = {};

    function ModeOptionsControl(params) {
        options = $.extend({}, defaults, params);
        this.options = options;
        this.initialize();
    }

    ModeOptionsControl.prototype = {
        initialize: initialize,
        events: events,
        eventNames: eventNames,
        getMode: getMode,
        setMode: setMode
    };

    return ModeOptionsControl;

    function initialize() {
        // update classes on mode toggle buttons
        $(options.selectors.modeToggle).on('click', options.selectors.modeOption, function(e) {
            e.preventDefault();

            $(this).addClass(options.selectors.onClass)
                .removeClass(options.selectors.offClass)
                .siblings(options.selectors.modeOption)
                    .removeClass(options.selectors.onClass)
                    .addClass(options.selectors.offClass);

            events.trigger(eventNames.toggle, getMode());
        });

        $(options.selectors.transitModeOption).on('click', function(e) {
            e.preventDefault();

            $(this).toggleClass(options.selectors.onClass + ' ' + options.selectors.offClass)
                .find('i').toggleClass(options.selectors.transitIconOnOffClasses);

            var active = $(this).find('i').hasClass(options.selectors.transitIconOnClass);
            $(this).attr('title', active ? 'Click to disable transit' : 'Click to enable transit');
            events.trigger(eventNames.toggle, getMode());
        });
    }

    /**
     * Helper to return the mode string based on the buttons within the given input selector.
     * Does not reflect whether in bike share mode or not, which is controlled separately.
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
     * so that they match the mode string. Does not affect the bike share mode setting,
     * which is managed separately by the trip options modal.
     *
     * @param mode {String} OpenTripPlanner mode string like 'WALK,TRANSIT'
     */
    function setMode(mode) {
        var $modes = $(options.selectors.modePicker);
        if (!$modes) {
            console.error('no mode controls found to set');
            return;
        }

        _.each(options.modes, function(val, key) {
            // for purposes of the bike toggle button, BICYCLE and BICYCLE_RENT are the same
            if (key.indexOf('_RENT') >= 0) {
                key = key.replace('_RENT', '');
            }
            var $thisMode = $modes.find('.' + key);

            var addClass = options.selectors.offClass;
            var removeClass =  options.selectors.onClass;
            if (mode.indexOf(val) > -1) {
                addClass = removeClass;
                removeClass = options.selectors.offClass;
            }

            $thisMode.addClass(addClass);
            $thisMode.removeClass(removeClass);

            if (key === 'transit') {
                var $modeIcon = $thisMode.find('i');
                var prefix = options.selectors.transitIconClassPrefix;
                $modeIcon.addClass(prefix + addClass);
                $modeIcon.removeClass(prefix + removeClass);
            }
        });
    }

})(jQuery);
