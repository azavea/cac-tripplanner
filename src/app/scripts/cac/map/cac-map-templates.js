CAC.Map.Templates = (function (Handlebars) {
    'use strict';

    var module = {
        itinerarySummaries: itinerarySummaries,
        addressText: addressText
    };

    return module;

    // Template for itinerary summaries
    function itinerarySummaries(itineraries) {
        Handlebars.registerHelper('modeIcon', function(modeString) {
            var modeIcons = {
                BUS: 'bus',
                SUBWAY: 'subway',
                CAR: 'car',
                TRAIN: 'train',
                BICYCLE: 'bicycle',
                WALK: 'rocket'
            };

            return new Handlebars.SafeString('<i class="fa fa-'+ modeIcons[modeString] + '"></i>');
        });

        var source = '{{#each itineraries}}' +
                '<div class="block block-itinerary" data-itinerary="{{this.id}}">' +
                '{{#each this.modes}}' +
                ' {{modeIcon this}}' +
                '{{/each}}' +
                '<span class="short-description">Via {{this.via}}</span>' +
                '<span class="trip-duration">{{this.durationMinutes}} Minutes</span>' +
                '<span class="trip-distance">{{this.distanceMiles}} mi.</span>' +
                '<p><a class="itinerary" data-itinerary="{{this.id}}">View Directions</a></p>' +
                '</div>' +
                '{{/each}}';
        var template = Handlebars.compile(source);
        var html = template({itineraries: itineraries});
        return html;
    }

    function addressText(address) {
        var source = '{{ address.StAddr }} \n<small>{{ address.City }}, {{ address.Region }} {{ address.Postal }}</small>';
        var template = Handlebars.compile(source);
        var html = template({address: address});
        return html;
    }

})(Handlebars);
