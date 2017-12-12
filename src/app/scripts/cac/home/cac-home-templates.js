CAC.Home.Templates = (function (Handlebars) {
    'use strict';

    // precompiled HTML snippets
    var filterButtonBarTemplate = '';

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
        getFilterButtonBar: getFilterButtonBar
    };

    setupFilterTemplates();

    return module;

    function getFilterButtonBar() {
        return filterButtonBarTemplate;
    }

    /**
     * Dynamically select which filter control to use (button bar or dropdown).
     *
     * @param isHome {Boolean} true if currently on home page
     * @return {String} name of a registered Handlebars partial
     */
    function filterPartial(isHome) {
        // TODO: implement
        if (isHome) {
            console.log('is home');
        } else {
            console.log('not home');
        }
        return 'filterButtonBar';
    }

    // Initialize by registering the two compiled partials for the filter bar,
    // which be chosen dynamically when building the destinations list.
    function setupFilterTemplates() {
        var filterButtonBar = [
            '<div class="filter-picker">',
                '<div class="filter-toggle">',
                    '{{#each filterOptions}}',
                    '<div class="{{class}} filter-option" title="{{label}}" ',
                        'data-filter="{{value}}">',
                        '<span class="filter-label">{{label}}</span>',
                    '</div>',
                    '{{/each}}',
                '</div>',
            '</div>'].join('');

        filterButtonBarTemplate = Handlebars.compile(filterButtonBar);
        Handlebars.registerPartial('filterButtonBar', filterButtonBarTemplate);
        Handlebars.registerHelper('filterPartial', filterPartial);
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
        var source = [
            '<header class="places-header">',
                '<div class="places-header-content">',
                    '<h1>Places we love</h1>',
                    '<a href="#" class="map-view-btn">Map View</a>',
                    '{{> (filterPartial isHome) }}',
                '</div>',
            '</header>',
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

        var template = Handlebars.compile(source);
        return template({destinations: useDestinations,
                         alternateMessage: alternateMessage,
                         filterOptions: filterOptions,
                         isHome: isHome},
                         {data: {level: Handlebars.logger.WARN}});
    }

})(Handlebars);
