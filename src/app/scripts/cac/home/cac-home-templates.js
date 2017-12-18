CAC.Home.Templates = (function (Handlebars) {
    'use strict';

    // precompiled HTML snippets
    var filterButtonBarTemplate;
    var filterDropdownTemplate;
    var destinationListTemplate;

    var filterOptions = [
        {'class': 'all', 'label': 'All', 'value': 'All'},
        {'class': 'events', 'label': 'Events', 'value': 'Events'},
        {'class': 'nature', 'label': 'Nature', 'value': 'Nature'},
        {'class': 'exercise', 'label': 'Exercise', 'value': 'Exercise'},
        {'class': 'relax', 'label': 'Relax', 'value': 'Relax'},
        {'class': 'educational', 'label': 'Educational', 'value': 'Educational'},
    ];

    var module = {
        destinations: destinations,
        getFilterButtonBar: getFilterButtonBar,
        getFilterDropdown: getFilterDropdown
    };

    initialize();

    return module;

    function initialize() {
        setupFilterTemplates();
        compileDestinationListTemplate();
    }

    // returns HTML for the places header, for use on the map page
    function getFilterDropdown() {
        return filterDropdownTemplate({filterOptions: filterOptions});
    }

    // returns HTML for the places header, for use on the home page
    function getFilterButtonBar() {
        return filterButtonBarTemplate({filterOptions: filterOptions});
    }

    /**
     * Dynamically select which filter control to use (button bar or dropdown).
     *
     * @param isHome {Boolean} true if currently on home page
     * @return {String} name of a registered Handlebars partial
     */
    function filterPartial(isHome) {
        if (isHome) {
            return 'filterButtonBar';
        }
        return 'filterDropdown';
    }

    // Initialize by registering the two compiled partials for the filter bar,
    // which be chosen dynamically when building the destinations list.
    function setupFilterTemplates() {
        var filterButtonBar = [
            '<header class="places-header">',
                '<h1>Places we love</h1>',
                '<a href="#" class="map-view-btn">Map View</a>',
                '<div class="filter-toggle">',
                    '{{#each filterOptions}}',
                    '<div class="{{class}} filter-option" ',
                        'data-filter="{{value}}">',
                        '{{label}}',
                    '</div>',
                    '{{/each}}',
                '</div>',
            '</header>'].join('');

        var filterDropdown = [
            '<header class="places-header">',
                '<h1>Places we love</h1>',
                '<select class="filter-toggle">',
                    '{{#each filterOptions}}',
                    '<option class="{{class}} filter-option" ',
                        'data-filter="{{value}}" value="{{value}}">{{label}}</option>',
                    '{{/each}}',
                '</select>',
            '</header>'].join('');

        filterButtonBarTemplate = Handlebars.compile(filterButtonBar);
        filterDropdownTemplate = Handlebars.compile(filterDropdown);
        Handlebars.registerPartial('filterButtonBar', filterButtonBarTemplate);
        Handlebars.registerPartial('filterDropdown', filterDropdownTemplate);
        Handlebars.registerHelper('filterPartial', filterPartial);
    }

    function compileDestinationListTemplate() {
        var source = [
            '{{> (filterPartial isHome) }}',
            '{{#unless alternateMessage}}',
            '<ul class="place-list">',
                '{{#each destinations}}',
                '<li class="place-card no-origin" data-destination-id="{{ this.id }}" ',
                    'data-destination-x="{{ this.location.x }}" ',
                    'data-destination-y="{{ this.location.y }}">',
                    '<div class="place-card-photo-container">',
                    '<img class="place-card-photo"',
                        '{{#if this.image}}',
                            'src="{{ this.image }}"',
                        '{{else}}',
                            'src="https://placehold.it/310x155.jpg"',
                        '{{/if}}',
                        'width="310" height="155"',
                        'alt="{{ this.name }}" />',
                    '</div>',
                    '<h2 class="place-card-name">{{ this.name }}</h2>',
                    '<div class="place-card-travel-logistics">',
                        '<span class="place-card-travel-logistics-duration"></span> ',
                        'from <span class="place-card-travel-logistics-origin">origin</span>',
                    '</div>',
                    '<div class="place-card-actions">',
                        '<a class="place-card-action place-action-go"',
                            'data-destination-id="{{ this.id }}" href="#">Directions</a>',
                        '<a class="place-card-action place-action-details"',
                           'href="/place/{{ this.id }}/">More info</a>',
                    '</div>',
                '</li>',
                '{{/each}}',
            '</ul>',
            '{{/unless}}',
            '{{#if alternateMessage}}',
            '<div class="place-list">',
                '<h2 class="no-places">{{alternateMessage}}</h2>',
            '</div>',
            '{{/if}}',
        ].join('');

        destinationListTemplate = Handlebars.compile(source);
    }

    /**
     * Take list of destination objects and return templated HTML snippet for places list.
     * Note this template HTML is also part of the Django template `home.html`.
     *
     * @param useDestinations {Array} Collection of JSON destinations from /api/destinations/search
     * @param alternateMessage {String} Text to display if there are no destinations
     * @param isHome {Boolean} True if currently on home page (and not map page)
     * @return html {String} Snippets for boxes to display on home page for each destination
     */
    function destinations(useDestinations, alternateMessage, isHome) {
        return destinationListTemplate({destinations: useDestinations,
                                       alternateMessage: alternateMessage,
                                       filterOptions: filterOptions,
                                       isHome: isHome},
                                       {data: {level: Handlebars.logger.WARN}});
    }

})(Handlebars);
