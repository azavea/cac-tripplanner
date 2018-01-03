CAC.Home.Templates = (function (Handlebars, moment) {
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
                '<div class="filter-toggle filter-toggle-tabs">',
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
                '<div class="custom-select">',
                    '<select class="filter-toggle filter-toggle-dropdown">',
                        '{{#each filterOptions}}',
                        '<option class="{{class}} filter-option" ',
                            'data-filter="{{value}}" value="{{value}}">{{label}}</option>',
                        '{{/each}}',
                    '</select>',
                '</div>',
            '</header>'].join('');

        filterButtonBarTemplate = Handlebars.compile(filterButtonBar);
        filterDropdownTemplate = Handlebars.compile(filterDropdown);
        Handlebars.registerPartial('filterButtonBar', filterButtonBarTemplate);
        Handlebars.registerPartial('filterDropdown', filterDropdownTemplate);
        Handlebars.registerHelper('filterPartial', filterPartial);

        // date/time formatting helpers for events
        Handlebars.registerHelper('eventDate', function(dateTime) {
            var dt = moment(dateTime); // get ISO string
            // format date portion like: Tue Dec 26
            return new Handlebars.SafeString(dt.format('ddd MMM D'));
        });

         Handlebars.registerHelper('eventTime', function(dateTime) {
            var dt = moment(dateTime); // get ISO string
            // format time portion like: 10:19 am
            return new Handlebars.SafeString(dt.format('h:mm a'));
        });

         // Helper to check if event starts and ends on the same day
         Handlebars.registerHelper('sameDay', function(dt1, dt2) {
            return(moment(dt1).isSame(dt2, 'day'));
        });
    }

    function compileDestinationListTemplate() {
        var source = [
            '{{> (filterPartial isHome) }}',
            '{{#unless alternateMessage}}',
            '<ul class="place-list">',
                '{{#each destinations}}',
                '<li class="place-card no-origin {{#if this.start_date}}event-card{{/if}}" ',
                    'data-destination-id="{{ this.id }}_{{this.placeID}}" ',
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
                    '<div class="place-card-info">',
                        '<div class="place-card-meta">',
                            '<div class="travel-logistics">',
                                '<span class="travel-logistics-duration"></span> ',
                                'from <span class="travel-logistics-origin">origin</span>',
                            '</div>',
                            '<div class="event-label">',
                                'Upcoming Event',
                            '</div>',
                            '<div class="event-date-time">',
                            '{{#if this.start_date }}',
                                '{{#if (sameDay this.start_date this.end_date) }}',
                                '<div class="event-date">',
                                    '{{eventDate this.start_date }}',
                                '</div>',
                                '<div class="event-time">',
                                    '<span class="start-time">{{eventTime this.start_date }}</span>',
                                    '&ndash;',
                                    '<span class="end-time">{{eventTime this.end_date }}</span>',
                                '</div>',
                                '{{else}}',
                                '<div class="event-date event-time">',
                                    'starts: {{eventDate this.start_date }} {{eventTime this.start_date }}',
                                '</div>',
                                '<div class="event-date event-time">',
                                    'ends: {{eventDate this.end_date }} {{eventTime this.end_date }}',
                                '</div>',
                                '{{/if}}',
                            '{{/if}}',
                            '</div>',
                        '</div>',
                        '<h2 class="place-card-name">{{ this.name }}</h2>',
                    '</div>',
                    '<div class="place-card-footer">',
                        '<div class="place-card-actions">',
                            '{{#if this.placeID}}',
                            '<a class="place-card-action place-action-go" ',
                                'data-destination-id="{{ this.id }}_{{this.placeID}}" ',
                                'href="#">Directions</a>',
                            '{{/if}}',
                            '<a class="place-card-action place-action-details" href=',
                            '"/{{#if this.start_date }}event{{else}}place{{/if}}/{{ this.id }}/"',
                               '>More info</a>',
                        '</div>',
                        '<div class="place-card-badges">',
                            '{{#if this.cycling}}',
                            '<span class="badge activity" title="Biking trails">',
                                '<i class="icon-cycling"></i>',
                            '</span>',
                            '{{/if}}',
                            '{{#if this.watershed_alliance}}',
                            '<a class="badge link" href="https://www.watershedalliance.org/"',
                                'title="Alliance for Watershed Education" target="_blank">',
                                '<img class="image" ',
                                    'src="/static/images/awe-icon.png"',
                                    'srcset="/static/images/awe-icon.png 1x, ',
                                    '/static/images/awe-icon@2x.png 2x" ',
                                    'height="20" ',
                                    'alt="Alliance for Watershed Education"></a>',
                            '{{/if}}',
                        '</div>',
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

})(Handlebars, moment);
