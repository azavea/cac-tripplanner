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
     * @return html {String} Snippets for boxes to display on home page for each destination
     */
    function destinations(useDestinations) {
        var source = [
            '{{#each destinations}}',
            '<li class="place-card no-origin">',
                '<img class="place-card-photo"',
                    '{{#if this.image}}',
                        'src="{{ this.wide_image }}"',
                    '{{else}}',
                        'src="https://placehold.it/400x400.jpg"',
                    '{{/if}}',
                    'width="400" height="200"',
                    'alt="{{ this.name }}" />',
                '<h2>{{ this.name }}</h2>',
                '<div class="place-card-travel-logistics">',
                    '<span class="place-card-travel-logistics-duration">N</span> ',
                    'min from <span class="place-card-travel-logistics-origin">origin</span>',
                '</div>',
                '<div class="place-card-actions">',
                    '<a class="place-card-action place-action-go"',
                        'data-destination-id="{{ this.id }}" href="#">Directions</a>',
                    '<a class="place-card-action place-action-details"',
                       'href="/place/{{ this.id }}/">More info</a>',
                '</div>',
            '</li>',
            '{{/each}}'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({destinations: useDestinations});
        return html;
    }

})(Handlebars);
