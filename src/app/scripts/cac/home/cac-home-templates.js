CAC.Home.Templates = (function (Handlebars) {
    'use strict';

    // precompiled HTML snippets
    var filterButtonBarTemplate = '';

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
     * @return {String} name of a registered Handlebars partial
     */
    function filterPartial() {
        // TODO: implement
        return 'filterButtonBar';
    }

    // Initialize by registering the two compiled partials for the filter bar,
    // which be chosen dynamically when building the destinations list.
    function setupFilterTemplates() {
        var filterButtonBar = [
            '<div class="filter-picker">',
                '<div class="filter-toggle">',
                    '<div class="all filter-option on" title="All" data-filter="All">',
                        '<span class="filter-label">All</span>',
                    '</div>',
                    '<div class="events filter-option" title ="Events" ',
                        'data-filter="Events">',
                        '<span class="filter-label">Events</span>',
                    '</div>',
                    '<div class="nature filter-option" title="Nature" ',
                        'data-filter="Nature">',
                        '<span class="filter-label">Nature</span>',
                    '</div>',
                    '<div class="exercise filter-option" title="Exercise"',
                        'data-filter="Exercise">',
                        '<span class="filter-label">Exercise</span>',
                    '</div>',
                    '<div class="relax filter-option" title="Relax" data-filter="Relax">',
                        '<span class="filter-label">Relax</span>',
                    '</div>',
                    '<div class="educational filter-option" title ="Educational"',
                        'data-filter="Educational">',
                        '<span class="filter-label">Educational</span>',
                    '</div>',
                    '<input type="hidden" name="destination-filter" value="All">',
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
     * @return html {String} Snippets for boxes to display on home page for each destination
     */
    function destinations(useDestinations, alternateMessage) {
        var source = [
            '<header class="places-header">',
                '<div class="places-header-content">',
                    '<h1>Places we love</h1>',
                    '<a href="#" class="map-view-btn">Map View</a>',
                    '{{> (filterPartial) }}',
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
        var html = template({destinations: useDestinations,
                             alternateMessage:alternateMessage},
                             {data: {level: Handlebars.logger.WARN}});
        return html;
    }

})(Handlebars);
