CAC.Home.Templates = (function (Handlebars) {
    'use strict';

    var module = {
        destinations: destinations
    };

    return module;

    function destinations(destinations) {
        var source = [
            '{{#each destinations}}',
            '<div class="col-sm-4">',
            '<a class="block block-destination block-half" href="#">',
            '<h3 class="destination-name">{{this.name}}</h3>',
            '<h5 class="destination-address">{{this.address}}</h5>',
            '<h5 class="destination-address-2">{{this.city}}, {{this.state}} {{this.zip}}</h5>',
            '<img src="{{#if this.wide_image}}{{ this.wide_image }}{{^}}http://placehold.it/300x150{{/if}}"',
            ' width="400" height="200"/>',
            '</a>',
            '</div>',
            '{{/each}}'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({destinations: destinations});
        return html;
    }

})(Handlebars);
