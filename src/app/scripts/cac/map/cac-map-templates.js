CAC.Map.Templates = (function (Handlebars, moment, Utils) {
    'use strict';

    var module = {
        addressText: addressText,
        bikeSharePopup: bikeSharePopup,
        destinationBlock: destinationBlock,
        destinationError: destinationError,
        destinationDetail: destinationDetail,
        eventPopup: eventPopup
    };

    return module;

    function addressText(address) {
        var source = '{{ address.StAddr }} \n<small>{{ address.City }}, {{ address.Region }} {{ address.Postal }}</small>';
        var template = Handlebars.compile(source);
        var html = template({address: address});
        return html;
    }

    // Helper to convert bike share API hours to a more readable format
    function reformatBikeShareHours(timeString) {
        var time = moment(timeString, 'HH:mm:ss');
        if (!time.isValid()) {
            // parsing failed; stick with the string the API gave us
            console.warn('Could not parse time string ' + timeString);
            return timeString;
        }
        return time.format('hh:mm A');
    }

    function bikeSharePopup(share) {
        share.properties.openTime = reformatBikeShareHours(share.properties.openTime);
        share.properties.closeTime = reformatBikeShareHours(share.properties.closeTime);
        if (share.properties.isEventBased) {
            share.properties.eventStart = reformatBikeShareHours(share.properties.eventStart);
            share.properties.eventEnd = reformatBikeShareHours(share.properties.eventEnd);
        }
        share.properties.indegoLogo = Utils.getImageUrl('indego_logo.png');
        var source = [
            '<div class="bikeshare"><h4>{{share.name}}</h4>',
            '<p><strong>{{share.addressStreet}}</strong></p>',
            '<p>Status: {{share.kioskPublicStatus}}</p>',
            '<p>Hours: {{share.openTime}} to {{share.closeTime}}</p>',
            '{{#if share.isEventBased}}<p>Event hours: {{share.eventStart}} to {{share.eventEnd}}</p>{{/if}}',
            '<p>{{share.bikesAvailable}} / {{share.totalDocks}} bikes available</p>',
            '<p>{{share.docksAvailable}} / {{share.totalDocks}} docks available</p>',
            '{{#if share.trikesAvailable}}<p>{{share.trikesAvailable}} trikes available</p>{{/if}}',
            '<a href="https://www.rideindego.com/" target="_blank">',
            '<img alt="Indego" src="{{share.indegoLogo}}" width="48px" height="18.75px" /></a>',
            '</div>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({share: share.properties});
        return html;
    }

    function destinationBlock(destination) {
        var source = [
            '<a class="block block-destination" id="destination-{{ d.id }}">',
                '<div class="modes"></div>',
                '<h3>{{ d.name }}</h3>',
                '<h5 class="distance-minutes"></h5>',
                '<img src="{{#if d.wide_image}}{{ d.wide_image }}{{^}}https://placehold.it/300x150{{/if}}" width="300px" height="150px" />',
            '</a>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({d: destination});
        return html;
    }

    function destinationError(error) {
        var source = [
            '<a class="block block-destination">',
                '<div class="modes"></div>',
                '<h3>{{ error.message }}</h3>',
            '</a>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({error: error});
        return html;
    }

    function destinationDetail(destination) {
        var source = [
            '<div class="block-detail">',
                '<h3>{{ d.name }}</h3>',
                '<h5 class="distance-minutes">{{#if d.durationMinutes}}{{ d.durationMinutes }} minutes away{{/if}}</h5>',
                '<img src="{{#if d.wide_image}}{{ d.wide_image }}{{^}}https://placehold.it/300x150{{/if}}" width="300px" height="150px" />',
                '{{{ d.description }}}',    // the parent element of whatever is put here is a <p> tag
                '<div class="row">',
                    // .back and .getdirections are used to select these elements for the click event
                    '<a class="back col-xs-6">Back</a>',
                    '<a class="getdirections col-xs-6">Get Directions</a>',
                '</div>',
            '</div>'
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

})(Handlebars, moment, CAC.Utils);
