CAC.Map.Templates = (function (Handlebars, moment, Utils) {
    'use strict';

    var module = {
        alert: alert,
        addressText: addressText,
        bicycleWarningAlert: bicycleWarningAlert,
        bikeSharePopup: bikeSharePopup,
        destinationBlock: destinationBlock,
        destinationError: destinationError,
        destinationDetail: destinationDetail,
        eventPopup: eventPopup,
        itinerary: itinerary,
        itineraryList: itineraryList
    };

    // Only register these once, when the module loads
    registerListItemHelpers();

    return module;

    function addressText(address) {
        var source = '{{ address.StAddr }} \n<small>{{ address.City }}, {{ address.Region }} {{ address.Postal }}</small>';
        var template = Handlebars.compile(source);
        var html = template({address: address});
        return html;
    }

    /**
     * Build an HTML snippet for a Bootstrap alert, with close button
     * http://getbootstrap.com/components/#alerts
     *
     * @param {string} message Message to display
     * @param {string} type Alert type (success, warning, info, or danger)
     * @returns {String} Compiled Handlebars template for the Bootstrap alert
     */
    function alert(message, type) {
        var info = {
            message: message,
            type: type
        };
        var source = [
            '<div class="alert-container">',
            '<div class="alert alert-{{info.type}} alert-dismissible" role="alert">',
            '<button type="button" class="close" data-dismiss="alert" aria-label="Close">',
            '<span aria-hidden="true">&times;</span></button>',
            '{{info.message}}',
            '</div></div>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({info: info});
        return html;
    }

    /**
     * Build an HTML snippet for an alert with links to transit agencies' bicycle policies
     *
     * @param {array} agencies List of agency names to link to (agencyName from OTP leg)
     * @returns {String} Compiled Handlebars template for the Bootstrap alert
     */
    function bicycleWarningAlert(agencies) {
        var policyLinks = {
            'SEPTA': 'http://www.septa.org/policy/bike.html',
            'NJ TRANSIT BUS': 'http://www.njtransit.com/rg/rg_servlet.srv?hdnPageAction=BikeProgramTo',
            'NJ TRANSIT RAIL': 'http://www.njtransit.com/rg/rg_servlet.srv?hdnPageAction=BikeProgramTo',
            'Port Authority Transit Corporation': 'http://www.ridepatco.org/travel/bicycles.html',
            'DART First State': 'http://www.dartfirststate.com/information/programs/bike/index.shtml'
        };

        var msg = 'Check agency bike policy before riding: ';
        _.each(agencies, function(agency) {
                msg += ['<a class="alert-link" target="_blank" href="',
                        policyLinks[agency],
                        '">',
                        agency,
                        '</a>, '].join('');
        });
        msg = msg.substring(0, msg.length - 2); // trim off trailing comma

        // message is not templated, so we can embed links
        var source = [
            '<div class="alert-container">',
            '<div class="alert alert-{{type}} alert-dismissible" role="alert">',
            '<button type="button" class="close" data-dismiss="alert" aria-label="Close">',
            '<span aria-hidden="true">&times;</span></button>',
            msg,
            '</div></div>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({type: 'warning'});
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
        // re-enable hours display if changed from 24 hours
        //share.properties.openTime = reformatBikeShareHours(share.properties.openTime);
        //share.properties.closeTime = reformatBikeShareHours(share.properties.closeTime);
        if (share.properties.isEventBased) {
            share.properties.eventStart = reformatBikeShareHours(share.properties.eventStart);
            share.properties.eventEnd = reformatBikeShareHours(share.properties.eventEnd);
        }
        share.properties.indegoLogo = Utils.getImageUrl('indego_logo.png');
        var source = [
            '<h4>{{share.name}}</h4>',
            '<p class="bikeshare"><strong>{{share.addressStreet}}</strong></p>',
            '<p class="bikeshare">Status: {{share.kioskPublicStatus}}</p>',
            '{{#if share.isEventBased}}<p>Event hours: {{share.eventStart}} to {{share.eventEnd}}</p>{{/if}}',
            '<p class="bikeshare">{{share.bikesAvailable}} bikes available</p>',
            '<p class="bikeshare">{{share.docksAvailable}} docks open</p>',
            '{{#if share.trikesAvailable}}<p>{{share.trikesAvailable}} trikes available</p>{{/if}}',
            '<a href="https://www.rideindego.com/" target="_blank">',
            '<img alt="Indego" src="{{share.indegoLogo}}" width="48px" height="18.75px" /></a>',
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
                '<img src="{{#if d.wide_image}}{{ d.wide_image }}{{^}}https://placehold.it/300x150{{/if}}" />',
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
                '<div class="trip-numbers">{{#if d.formattedDuration}}<div class="trip-duration"> ',
                '{{ d.formattedDuration }}</div>{{/if}}<div class="trip-distance">',
                '{{ d.distanceMiles }}</div></div>',
                '<h3>{{ d.name }}</h3>',
                '<img class="explore-block" src="{{#if d.wide_image}}{{ d.wide_image }}',
                    '{{^}}https://placehold.it/300x150{{/if}}" />',
                    // the parent element of whatever is put here is a <p> tag
                '<div class="explore-block">{{{ d.description }}}</div>',
                '<div class="explore-block"><a href="{{ d.website_url }}" ',
                'target="_blank">{{ d.website_url }}</a></div>',
                '<div class="explore-block visible-xs mobile-unavailable">GoPhillyGo directions are not available on mobile at this time, but this button can give you directions from Google.</div>',
                '<div class="explore-block">',
                    '<div class="row">',
                        // .back and .getdirections are used to select these elements for the click event
                        '<div class="col-sm-6"><a class="back btn btn-primary btn-block hidden-xs">Back</a></div>',
                        '<div class="col-sm-6"><a class="getdirections btn btn-primary btn-block">',
                            'Get Directions</a></div>',
                    '</div>',
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
            '<div class="popup-header">',
                '<img class="popup-logo" src="{{ event.uwishunuLogo }}" width="30px" height="30px" />',
                '<h4 class="popup-title">{{ event.title }}</h4>',
            '</div>',
            '<p class="popup-text">{{{ event.description }}}</p>',
            '<small>Events by <a href="https://www.uwishunu.com">Uwishunu</a>',
            '<a href="{{ event.link }}" target="_blank" class="pull-right">More Info</a>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({event: event});
        return html;
    }

    // Template for itinerary summaries
    function itineraryList(itineraries) {
        var source = ['{{#each itineraries}}',
            '<div class="route-summary" data-itinerary="{{this.id}}">',
            '<svg class="route-summary-path" width="3" height="100%" xmlns="http://www.w3.org/2000/svg">',
                '<line x1="50%" y1="6%" x2="50%" y2="94%" stroke-width="3" stroke="#e23331"></line>',
            '</svg>',
            '<div class="route-summary-details">',
                '<div class="route-summary-primary-details">',
                    '<div class="route-duration units">{{this.formattedDuration}}</div>',
                    '<div class="route-distance">{{this.distanceMiles}}  <span class="units">miles</span></div>',
                    '<div class="route-name">via {{this.via}}</div>',
                '</div>',
                '<div class="route-summary-secondary-details">',
                    // TODO: add formatted start and end times to itinerary info
                    '<div class="route-start-stop">3:14pm – 3:48pm</div>',
                    '<div class="route-modes">',
                        '{{#each this.modes}}',
                            ' {{modeIcon this}}',
                        '{{/each}}',
                    '</div>',
                '</div>',
            '</div>',
        '</div>{{/each}}'].join('');

        // TODO: split out units from formatted duration to go in separate span
        //<div class="route-duration">33 <span class="units">min</span></div>',

        var template = Handlebars.compile(source);
        var html = template({itineraries: itineraries});
        return html;
    }

    function itinerary(templateData) {
        // The &nbsp;'s are used instead of 'hide' classes because of some styling-related issues
        var source = [
            '<div class="block block-step directions-header">',
                'Directions',
                '{{#if data.showBackButton}}<div class="pull-right"><a class="back pull-right">',
                '<i class="md md-close"></i></a></div>{{/if}}',
                '<div class="share-dropdown pull-right dropdown">{{#if data.showShareButton}}',
                    '<a class="share dropdown-toggle" data-toggle="dropdown">',
                    '<i class="md md-share"></i></a>',
                    '<ul class="dropdown-menu">',
                        '<li><a id="directLinkBtn" title="Link" data-toggle="tooltip" ',
                            'data-target="link-modal" data-toggle="link-modal" ',
                                '<i class="fa fa-2x fa-link"></i>',
                        '</a></li>',
                        '<li><a id="twShareBtn" title="Twitter" data-toggle="tooltip"',
                            'data-target="#" <i class="fa fa-2x fa-twitter-square"></i>',
                        '</a></li>',
                        '<li><a id="fbShareBtn" title="Facebook" data-toggle="tooltip" ',
                            'data-target="#" <i class="fa fa-2x fa-facebook-official"></i>',
                        '</a></li>',
                        '<li><a id="gpShareBtn" title="Google+" data-toggle="tooltip" ',
                            'data-target="#" <i class="fa fa-2x fa-google-plus"></i>',
                        '</a></li>',
                        '<li><a id="emailShareBtn" title="E-Mail" data-toggle="tooltip" ',
                            'data-target="#" <i class="fa fa-2x fa-envelope"></i>',
                        '</a></li>',
                    '</ul>{{/if}} ',
                    '<span class="directions-header-divider">|</span> ',
                '</div>',
            '</div>',
            '<div class="block block-step direction-depart">',
                '<table><tr><td class="direction-icon"><i class="md md-place"></i></td>',
                    '<td>Depart from <strong>{{data.start.text}} at {{datetime data.start.time}}</td>',
                '</tr></table></strong>',
            '</div>',
            '<div class="block-legs">',
                '{{#each data.legs}}',
                    '<div class="block block-leg">',
                        '<div class="trip-numbers">',
                            '<div class="trip-duration">',
                                '{{this.formattedDuration}}',
                            '</div>',
                            '<div class="trip-distance">',
                                '{{inMiles this.distance}} mi',
                            '</div>',
                        '</div>',
                        '<div class="trip-details">',
                            '<div class="direction-section"><table><tr>',
                            '<td class="direction-icon">',
                            '{{modeIcon this.mode}}</td><td class="direction-text direction-item"',
                            ' data-lat="{{this.from.lat}}" data-lon="{{this.from.lon}}" >',
                            '{{#if this.transitLeg}}{{this.agencyName}} {{this.route}} ',
                                '{{this.headsign}}{{/if}} ',
                            'to {{this.to.name}}',
                            '{{#if this.transitLeg }} at {{datetime this.startTime}}{{/if}}',
                            '</td></tr></table></div>',
                            '<div class="block direction-item"',
                            ' data-lat="{{this.from.lat}}" data-lon="{{this.from.lon}}" >',
                                '{{#each steps}}',
                                    '<div class="block block-step direction-item"',
                                        ' data-lat="{{ lat }}" data-lon="{{ lon }}" >',
                                        '<span>{{ directionText }}</span>',
                                        '<span class="pull-right">{{ inMiles this.distance }} mi</span>',
                                    '</div>',
                                '{{/each}}',
                            '</div>',
                        '</div>',
                    '</div>',
                '{{/each}}',
            '</div>',
            '<div class="block block-step direction-arrive">',
                '<table><tr><td class="direction-icon"><i class="md md-place"></i></td>',
                    '<td>Arrive at <strong>{{data.end.text}} at {{datetime data.end.time}}</td>',
                '</tr></table></strong>',
            '</div>',
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({data: templateData});
        return html;
    }

    function registerListItemHelpers() {
        Handlebars.registerHelper('directionIcon', function(direction) {
            return new Handlebars.SafeString('<span class="glyphicon '+
                                             getTurnIconName(direction) + '"></span>');
        });
        Handlebars.registerHelper('directionText', function () {
            var text = turnText(this.relativeDirection, this.streetName, this.absoluteDirection);
            return new Handlebars.SafeString('<span>' + text + '</span>');
        });

        Handlebars.registerHelper('modeIcon', function(modeString) {
            return new Handlebars.SafeString(Utils.modeStringHelper(modeString));
        });

        Handlebars.registerHelper('datetime', function(dateTime) {
            return new Handlebars.SafeString(new Date(dateTime).toLocaleTimeString());
        });

        Handlebars.registerHelper('inMiles', function(meters) {
            return new Handlebars.SafeString(Math.round(((meters / 1000) * 0.621371) * 100) / 100);
        });
    }

    function getTurnIconName(turnType) {
        switch (turnType) {
            case 'DEPART':
            case 'CONTINUE':
                return 'glyphicon-arrow-up';
            // Temporarily fall through to similar cases for left/right
            case 'LEFT':
            case 'SLIGHTLY_LEFT':
            case 'HARD_LEFT':
            case 'UTURN_LEFT':
                return 'glyphicon-arrow-left';
            case 'RIGHT':
            case 'SLIGHTLY_RIGHT':
            case 'HARD_RIGHT':
            case 'UTURN_RIGHT':
                return 'glyphicon-arrow-right';
            case 'CIRCLE_CLOCKWISE':
            case 'CIRCLE_COUNTERCLOCKWISE':
                return 'glyphicon-repeat';
            case 'ELEVATOR':
                return 'glyphicon-cloud-upload';
            default:
                return 'glyphicon-remove-circle';
        }
    }

    function turnText(turn, street, direction) {
        var turnTextString = '';
        var turnLower = turn.toLowerCase();
        var turnSplit = turnLower.replace('_', ' ');
        street = Utils.abbrevStreetName(street);
        if (turn === 'DEPART') {
            turnTextString = 'Head ' + direction.toLowerCase() + ' on ' + street;
        } else if (turn === 'CONTINUE') {
            turnTextString = 'Continue on to ' + street;
        } else if (turn === 'ELEVATOR') {
            turnTextString = 'Take the elevator to ' + street;
        } else if (turn.indexOf('UTURN') !== -1) {
            turnTextString = 'Take a U-turn on to ' + street;
        } else if (turn.indexOf('LEFT') !== -1 || turn.indexOf('RIGHT') !== -1) {
            turnTextString = 'Turn ' + turnSplit + ' on to ' + street;
        } else if (turn.indexOf('CIRCLE') !== -1) {
            turnTextString = 'Enter the traffic circle, then exit on to ' + street;
        }
        return turnTextString;
    }

})(Handlebars, moment, CAC.Utils);
