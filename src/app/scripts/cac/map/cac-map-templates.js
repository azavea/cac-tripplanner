CAC.Map.Templates = (function (Handlebars) {
    'use strict';

    var module = {
        itinerarySummaries: itinerarySummaries,
        addressText: addressText,
        destinationBlock: destinationBlock,
        eventPopup: eventPopup
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

    function destinationBlock(destination) {
        var source = [
            '<a class="block block-destination">',
                '<div class="modes"></div>',
                '<h3>{{ d.name }}</h3>',
                '<h5>20 minutes away</h5>',
                '<img src="{{#if d.wide_image}}{{ d.wide_image }}{{^}}http://placehold.it/300x150{{/if}}" width="300px" height="150px" />',
            '</a>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({d: destination});
        return html;
    }

    function eventPopup(event) {
        var source = [
            '<h4>{{ event.title }}</h4>',
            '<p>{{{ event.description }}}</p>',
            '<a href="{{ event.link }}" target="_blank">More Info</a>',
            '<small class="pull-right">Events by <a href="http://www.uwishunu.com">Uwishunu</a>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({event: event});
        return html;
    }

})(Handlebars);
