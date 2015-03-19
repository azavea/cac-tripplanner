CAC.Map.Templates = (function (Handlebars, Utils) {
    'use strict';

    var module = {
        addressText: addressText,
        destinationBlock: destinationBlock,
        eventPopup: eventPopup
    };

    return module;

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
        event.uwishunuLogo = Utils.getImageUrl('uwishunu_logo.png');
        var source = [
            '',
            '<h4><img src="{{ event.uwishunuLogo }}" width="30px" height="30px" /> {{ event.title }}</h4>',
            '<p>{{{ event.description }}}</p>',
            '<a href="{{ event.link }}" target="_blank">More Info</a>',
            '<small class="pull-right">Events by <a href="http://www.uwishunu.com">Uwishunu</a>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({event: event});
        return html;
    }

})(Handlebars, CAC.Utils);
