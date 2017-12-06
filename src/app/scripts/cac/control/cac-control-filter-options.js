CAC.Control.FilterOptions = (function ($) {
    'use strict';

    var defaults = {
        defaultFilter: 'all',
        selectors: {
            // filter related selectors
            filterToggle: '.filter-toggle',
            filterOption: '.filter-option',
            filterPicker: '.filter-picker', // parent to filterOption
            onClass: 'on',
            offClass: 'off',
            selectedFilter: '.filter-option.on'
        }
    };
    var events = $({});
    var eventNames = {
        toggle: 'cac:control:filteroptions:toggle'
    };
    var options = {};

    function FilterOptionsControl(params) {
        options = $.extend({}, defaults, params);
        this.options = options;
        this.initialize();
    }

    FilterOptionsControl.prototype = {
        initialize: initialize,
        events: events,
        eventNames: eventNames,
        getFilter: getFilter,
        setFilter: setFilter
    };

    return FilterOptionsControl;

    function initialize() {
        // update classes on filter toggle buttons
        $(options.selectors.filterToggle).on('click', options.selectors.filterOption, function(e) {
            e.preventDefault();

            $(this).addClass(options.selectors.onClass)
                .removeClass(options.selectors.offClass)
                .siblings(options.selectors.filterOption)
                    .removeClass(options.selectors.onClass)
                    .addClass(options.selectors.offClass);

            events.trigger(eventNames.toggle, getFilter());
        });
    }

    /**
     * Helper to return the filter string based on the buttons within the given input selector.
     *
     * @returns {String} selected filter
     */
    function getFilter() {
        var $selected = $(options.selectors.selectedFilter);
        if (!$selected) {
            console.error('no filter controls found to read');
            return options.defaultFilter;
        }

        return $selected.data('filter') || options.defaultFilter;
    }

    /**
     * Helper to set the appropriate buttons within the given input selector
     * so that they match the filter string.
     *
     * @param filter {String} Destination filter
     */
    function setFilter(filter) {
        var $filters = $(options.selectors.filterPicker);
        if (!$filters) {
            console.error('no filter controls found to set');
            return;
        }

        _.each(options.filters, function(val, key) {

            var $thisFilter = $filters.find('[data-filter="' + key + '"]');

            var addClass = options.selectors.offClass;
            var removeClass =  options.selectors.onClass;
            if (filter.indexOf(val) > -1) {
                addClass = removeClass;
                removeClass = options.selectors.offClass;
            }

            $thisFilter.addClass(addClass);
            $thisFilter.removeClass(removeClass);
        });
    }

})(jQuery);
