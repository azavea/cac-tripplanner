CAC.Control.FilterOptions = (function ($) {
    'use strict';

    var defaults = {
        defaultFilter: 'All',
        selectors: {
            // filter related selectors
            filterToggle: '.filter-toggle',
            filterOption: '.filter-option',
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
        setFilter: setFilter,
        destroy: destroy
    };

    return FilterOptionsControl;

    // helper to set the 'on' class for the selected option, and unset it for the others
    function toggleOn(selector) {
        $(selector).addClass(options.selectors.onClass)
                .removeClass(options.selectors.offClass)
                .siblings(options.selectors.filterOption)
                    .removeClass(options.selectors.onClass)
                    .addClass(options.selectors.offClass);
    }

    function initialize() {
        // filter toggle button row event handler
        $(options.selectors.filterToggle).on('click', options.selectors.filterOption, function(e) {
            e.preventDefault();
            toggleOn(this);
            events.trigger(eventNames.toggle, getFilter());
        });

        // filter drop-down button event handler
        $(options.selectors.filterToggle).on('change', function(e) {
            e.preventDefault();
            if (!e.target.selectedOptions || !e.target.selectedOptions.length) {
                return;
            }

            toggleOn(e.target.selectedOptions[0]);
            events.trigger(eventNames.toggle, getFilter());
        });
    }

    function destroy() {
        // clear handlers
        $(options.selectors.filterToggle).off();
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
        var $filters = $(options.selectors.filterOption);
        if (!$filters || $filters.length === 0) {
            // in test, selector will not exist
            return;
        }

        $filters.removeClass(options.selectors.onClass);
        $filters.addClass(options.selectors.offClass);

        var $thisFilter = $(options.selectors.filterToggle).find('[data-filter="' + filter + '"]');

        // change display if in drop-down
        $(options.selectors.filterToggle).val(filter).change();

        // shouldn't happen, but guard against missing or bad filter being set
        if ($thisFilter.length !== 1) {
            console.warn('Could not find filter control matching filter ' + filter);
            $thisFilter = $filters.first(); // first option is 'All'
        }

        $thisFilter.removeClass(options.selectors.offClass);
        $thisFilter.addClass(options.selectors.onClass);
    }

})(jQuery);
