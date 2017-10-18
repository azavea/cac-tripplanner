CAC.Home.Templates = (function (Handlebars) {
    'use strict';

    var module = {
        destinations: destinations
    };

    return module;

    /**
     * Take list of destination objects and return templated HTML snippet for sidebar.
     *
     * @param useDestinations {Array} Collection of JSON destinations from /api/destinations/search
     * @param alternateMessage {String} Text to display if there are no destinations
     * @return html {String} Snippets for boxes to display on home page for each destination
     */
    function destinations(useDestinations, alternateMessage) {
        var source = [
            '{{#unless alternateMessage}}',
            '<header class="places-header">',
                '<h1>Places we love</h1>',
                '<a href="#" class="map-view-btn">Map View</a>',
            '</header>',
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
            '<header class="places-header">',
                '<h2 class="no-places">{{alternateMessage}}</h2>',
                '<a href="#" class="map-view-btn">Map View</a>',
            '</header>',
            '{{/if}}',
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({destinations: useDestinations,
                             alternateMessage:alternateMessage},
                             {data: {level: Handlebars.logger.WARN}});
        return html;
    }

})(Handlebars);
