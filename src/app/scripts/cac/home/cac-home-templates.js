CAC.Home.Templates = (function (Handlebars) {
    'use strict';

    var module = {
        articles: articles,
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
            '<div class="col-sm-4">',
            '<a class="block block-destination block-half" href="#">',
            '<h3 class="destination-name">{{this.name}}</h3>',
            '<h5 class="destination-address">{{this.address}}</h5>',
            '<h5 class="destination-address-2">{{this.city}}, {{this.state}} {{this.zip}}</h5>',
            '<img src="{{#if this.wide_image}}{{ this.wide_image }}{{^}}https://placehold.it/300x150{{/if}}"',
            ' width="400" height="200"/>',
            '</a>',
            '</div>',
            '{{/each}}'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({destinations: useDestinations});
        return html;
    }

    /**
     * Take list of articles and return templated HTML snippet for sidebar.
     *
     * @param articles {Array} Collection of JSON destinations from /api/artic
     * @return html {String} Snippets for boxes to display on home page for each destination
     */
    function articles(useArticles) {
        var source = [
            '{{#each articles}}',
            '<div class="col-sm-6">',
            '<a class="block block-spotlight" href="{{this.url}}">',
            '<h3 class="destination-name">{{this.title}}</h3>',
            '<h5>Community Profile</h5>',
            '{{#if this.narrow_image}}<img src="{{this.narrow_image}}" width="400" height="600"/>',
            '{{else}}<img src="https://placehold.it/400x600.jpg" />',
            '{{/if}}</a></div>{{/each}}'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({articles: useArticles});
        return html;
    }

})(Handlebars);
