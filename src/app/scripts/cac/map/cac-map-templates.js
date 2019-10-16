CAC.Map.Templates = (function (Handlebars, moment, Utils) {
    'use strict';

    var module = {
        alert: alert,
        bicycleWarningAlert: bicycleWarningAlert,
        bikeSharePopup: bikeSharePopup,
        eventPopup: eventPopup,
        itinerary: itinerary,
        itineraryList: itineraryList,
        tourDestinationList: tourDestinationList
    };

    // Only register these once, when the module loads
    registerListItemHelpers();

    return module;

    /**
     * Build an HTML snippet for a Bootstrap alert, with close button
     * http://getbootstrap.com/components/#alerts
     *
     * @param {string} message Message to display
     * @param {string} title Header for message
     * @param {string} type Alert type (success, warning, info, or danger)
     * @returns {String} Compiled Handlebars template for the Bootstrap alert
     */
    function alert(message, title, type) {
        var info = {
            message: message,
            title: title,
            type: type
        };

        var source = [
            '<div class="alert alert-{{info.type}}">',
            '<div class="alert-title">',
            '{{info.title}}',
            '<button title="Dismiss this message" name="close" class="close" aria-label="Close">',
            '<i class="icon-cancel"></i></button>',
            '</div>',
            '<div class="alert-body">',
            '{{info.message}}',
            '</div>',
            '</div>'
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
            '<div class="alert alert-bicycle">',
            '<div class="alert-title">',
            'Notice',
            '<button title="Dismiss this message" name="close" class="close" aria-label="Close">',
            '<i class="icon-cancel"></i></button>',
            '</div>',
            '<div class="alert-body">',
            msg,
            '</div>',
            '</div>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template();
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
        return time.format('h:mma');
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
            '<p class="bikeshare-logo"><a href="https://www.rideindego.com/" target="_blank">',
            '<img alt="Indego" src="{{share.indegoLogo}}" width="48px" height="18.75px" /></a></p>',
            '<h4 class="bikeshare-name">{{share.name}}</h4>',
            '<p class="bikeshare-address">{{share.addressStreet}}</p>',
            '<p class="bikeshare-status">{{share.kioskPublicStatus}}</p>',
            '{{#if share.isEventBased}}<p>Event hours: {{share.eventStart}} to {{share.eventEnd}}</p>{{/if}}',
            '<p class="bikeshare-bikes">{{share.bikesAvailable}} bikes available</p>',
            '{{#if share.trikesAvailable}}<p class="bikeshare-trikes">{{share.trikesAvailable}} trikes available</p>{{/if}}',
            '<p class="bikeshare-docks">{{share.docksAvailable}} docks open</p>',
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({share: share.properties});
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
        var source = [
        '<h1>Choose a route</h1><div class="routes-list">',
        '{{#each itineraries}}',
            '<div class="route-summary" data-itinerary="{{this.id}}">',
                '<div class="route-name">via {{this.via}}</div>',
                '<div class="route-details">',
                    '<div class="route-stats{{#unless showSummaryModes}} route-single-mode {{onlyModeClass modeSummaries}}{{/unless}}">',
                        '<span class="route-duration">',
                            '{{this.formattedDuration}}</span>',
                        '&ensp;&middot;&ensp;',
                        '<span class="route-distance">{{this.formattedDistance}}</span>',
                    '</div>',
                    '{{#if showSummaryModes}}',
                        '<div class="route-start-stop">{{datetime this.startTime}}&ndash;{{datetime this.endTime}}</div>',
                    '{{/if}}',
                '</div>',
                '{{#if showSummaryModes}}',
                    '<div class="route-per-mode-details">',
                        '{{#each modeSummaries}}',
                            '<div class="route-mode-stats {{modeClass @key}}">',
                                '{{this.formattedDuration}}&nbsp;&middot;&nbsp;{{this.formattedDistance}}',
                                '{{#if this.transfers}}&nbsp;&middot;&nbsp;{{this.transfers}}{{/if}}',
                            '</div>',
                        '{{/each}}',
                    '</div>',
                '{{/if}}',
            '</div>',
        '{{/each}}',
        '</div>'].join('');

        var template = Handlebars.compile(source);
        var html = template({itineraries: itineraries});
        return html;
    }

    function itinerary(templateData) {
        // The &nbsp;'s are used instead of 'hide' classes because of some styling-related issues
        var source = [
            '<div class="directions-step-by-step-content">',
                '<header class="step-by-step-header">',
                    '{{#if data.showBackButton}}',
                        '<button name="back-to-directions-results" class="back-to-directions-results" title="List all routes">',
                        '<i class="icon-left-big"></i></button>',
                    '{{/if}}',
                    '<h1>Directions</h1>',
                    '{{#if data.showShareButton}}',
                        '<button name="share-directions" class="share-directions">',
                            '<i class="icon-share"></i>',
                        '</button>',
                    '{{/if}}',
                '</header>',
                '<div class="directions-list-of-steps" data-itinerary-id="{{data.id}}">',
                    '<div class="directions-leg directions-leg-origin">',
                        '<div class="directions-step directions-step-origin">',
                        '<div class="directions-instruction">Depart {{data.start.text}}</div>',
                        '<div class="directions-time">at {{datetime data.start.time}}</div>',
                    '</div>',
                '</div>',
                '{{#each data.legs}}',
                    '<div class="directions-leg" ',
                        'data-lat="{{this.from.lat}}" data-lon="{{this.from.lon}}">',
                        '{{#if this.transitLeg}}',
                            // transit step directions
                            '<div class="directions-step {{modeClass this.mode}}" ',
                                'data-lat="{{ this.from.lat }}" data-lon="{{ this.from.lon }}">',
                                '<div class="directions-instruction">Board {{this.agencyName}} ',
                                '{{this.route}} {{this.headsign}}</div>',
                                '<div class="directions-time">at {{datetime this.startTime}}</div>',
                                '<div class="directions-distance">{{this.formattedDistance}}</div>',
                            '</div>',
                            '<div class="directions-step directions-step-disembark" ',
                                'data-lat="{{ this.to.lat }}" data-lon="{{ this.to.lon }}">',
                                '<div class="directions-instruction">Disembark <strong>',
                                    '{{this.to.name}}</strong></div>',
                            '</div>',
                        '{{else}}',
                            // non-transit step directions
                            '{{#each steps}}',
                                '<div class="directions-step ',
                                    '{{directionClass this.relativeDirection ../this.mode @index}}" ',
                                    'data-lat="{{ lat }}" data-lon="{{ lon }}">',
                                    '<div class="directions-instruction">{{directionText ../this @index}}</div>',
                                    '<div class="directions-distance">{{this.formattedDistance}}</div>',
                                '</div>',
                            '{{/each}}',
                            '{{#unless this.lastLeg}}',
                                '<div class="directions-step ',
                                    '{{#if this.toBikeShareStation}}directions-step-indego"',
                                    '{{else}}directions-step-arrive"{{/if}}',
                                    'data-lat="{{ this.to.lat }}" data-lon="{{ this.to.lon }}">',
                                    '<div class="directions-instruction"><strong>Arrive ',
                                    '{{#if this.toBikeShareStation}}Indego station, {{/if}}',
                                    '{{this.to.name}}</strong></div>',
                                '</div>',
                            '{{/unless}}', // unless last step
                        '{{/if}}', // end if transit or not
                    '</div>',
                '{{/each}}',
                '<div class="directions-leg directions-leg-destination">',
                    '<div class="directions-step directions-step-destination">',
                        '<div class="directions-instruction">Arrive {{data.end.text}}</div>',
                        '<div class="directions-time">at {{datetime data.end.time}}</div>',
                    '</div>',
                '</div>',
                // per-mode summary
                '{{#if data.showSummaryModes}}',
                '<div class="directions-mode-summary">',
                    '<div class="mode-summary-section mode-summary-header">',
                        '<div class="duration">Travel time</div>',
                        '<div class="distance">Distance</div>',
                    '</div>',
                    '{{#each data.modeSummaries}}<div class="mode-summary-section mode-summary-item {{modeClass @key}}">',
                        '<div class="duration">{{this.formattedDuration}}</div>',
                        '<div class="distance">{{this.formattedDistance}}</div>',
                    '</div>{{/each}}',
                    '<div class="mode-summary-section mode-summary-footer">',
                        '<div class="duration">{{data.formattedDuration}}</div>',
                        '<div class="distance">{{data.formattedDistance}}</div>',
                    '</div>',
                '</div>{{/if}}',
            '</div>'
        ].join('');
        var template = Handlebars.compile(source);
        var html = template({data: templateData});
        return html;
    }

    // Template for tour destinations
    // Note that the date/time helpers used here were registered in the home templates
    function tourDestinationList(tour) {
        var source = [
        '<div class="tour-list">',
            '<div class="tour-heading">',
                '<div class="tour-label">',
                    '{{#if tour.is_event}}Event{{else}}Tour{{/if}}',
                '</div>',
                '<h1 class="tour-name">{{ tour.name }}</h1>',
                '<div class="event-date-time">',
            	    '{{#if tour.is_event }}',
            	        '{{#if (sameDay tour.start_date tour.end_date) }}',
            	        '<div class="event-date event-time">',
            		    '{{eventDate tour.start_date }}',
            		    ' &middot; ',
            		    '{{eventTime tour.start_date }}',
            	        '</div>',
            	    '{{else}}',
            	        '<div class="event-date event-time">',
            		    '{{eventDate tour.start_date }}',
            		    ' &ndash; ',
            		    '{{eventDate tour.end_date }}',
            	        '</div>',
            	    '{{/if}}',
            	'{{/if}}',
            	'</div>',
            '</div>',
            '{{#each tour.destinations}}',
                '<div class="place-card place-card-compact no-origin" ',
                    'data-tour-place-index="{{ @index }}" ',
                    'data-tour-place-id="{{ this.id }}">',
                    '<div class="place-card-inner">',
                        '<div class="place-card-photo-container">',
                            '<img class="place-card-photo"',
                                '{{#if this.image}}',
                                    'src="{{ this.image }}"',
                                '{{else}}',
                                    'src="https://placehold.it/80x80.jpg"',
                                '{{/if}}',
                                'height="80"',
                                'alt="{{ this.name }}" />',
                        '</div>',
                        '<div class="place-card-info">',
                            '<div class="place-card-name oneline">{{ this.name }}</div>',
                            '<div class="place-card-actions">',
                                '<a class="place-card-action place-card-action-directions" ',
                                    'data-tour-place-index="{{ @index }}" ',
                                    'href="#">Directions</a>',
                                '<a class="place-card-action place-card-action-details" href=',
                                '"/place/{{ this.id }}/">More info</a>',
                            '</div>',
                        '</div>',
                    '</div>',
                '</div>',
            '{{/each}}',
        '</div>'].join('');

        var template = Handlebars.compile(source);
        var html = template({tour: tour});
        return html;
    }

    function registerListItemHelpers() {
        Handlebars.registerHelper('directionClass', function(direction, mode, index) {
            return new Handlebars.SafeString(getTurnIconClass(direction, mode, index));
        });

        Handlebars.registerHelper('directionText', function (leg, index) {
            var text = turnText(this, leg, index);
            return new Handlebars.SafeString('<span>' + text + '</span>');
        });

        Handlebars.registerHelper('modeClass', function(modeString) {
            return new Handlebars.SafeString(getModeClass(modeString));
        });

        Handlebars.registerHelper('modeIcon', function(modeString) {
            return new Handlebars.SafeString(Utils.modeStringHelper(modeString));
        });

        Handlebars.registerHelper('datetime', function(dateTime) {
            // round to the nearest minute
            var COEFF = 60000; // to round Unix timestamp to nearest minute
            var dt = moment(Math.round(dateTime / COEFF) * COEFF);
            return new Handlebars.SafeString(dt.format('h:mma'));
        });

        // class for the icon for the first mode in the mode summaries, for use when
        // there is only one mode present
        Handlebars.registerHelper('onlyModeClass', function(modeSummaries) {
            var modeString = _.keys(modeSummaries).first();
            return new Handlebars.SafeString(getModeClass(modeString));
        });
    }

    function getModeClass(modeText) {
        switch (modeText) {
            case 'BICYCLE':
                return 'directions-step-bike';
            default:
                return 'directions-step-' + modeText.toLowerCase();
        }
    }

    // Get icon class for step. The first step in a leg gets the mode icon (and absolute direction)
    function getTurnIconClass(turnType, modeText, index) {
        if (index === 0) {
            return getModeClass(modeText);
        }
        switch (turnType) {
            case 'DEPART':
                return getModeClass(modeText);
            case 'CONTINUE':
                return 'directions-step-continue';
            // fall through to similar cases for left/right
            case 'LEFT':
            case 'SLIGHTLY_LEFT':
            case 'HARD_LEFT':
            case 'UTURN_LEFT':
                return 'directions-step-turn-left';
            case 'RIGHT':
            case 'SLIGHTLY_RIGHT':
            case 'HARD_RIGHT':
            case 'UTURN_RIGHT':
                return 'directions-step-turn-right';
            case 'CIRCLE_CLOCKWISE':
                return 'directions-step-clockwise';
            case 'CIRCLE_COUNTERCLOCKWISE':
                return 'directions-step-counterclockwise';
            case 'ELEVATOR':
                return 'directions-step-elevator';
            default:
                return '';
        }
    }

    function getModeText(leg) {
        switch (leg.mode) {
            case 'BICYCLE':
                return 'Bike';
            case 'WALK':
                return 'Walk' + (leg.rentedBike ? ' the bike' : '');
            default:
                return 'Head';
        }
    }

    // Get the text for a step. The first step in a leg gets absolute direction.
    function turnText(step, leg, index) {
        var turn = step.relativeDirection;
        var street = step.streetName;
        var direction = step.absoluteDirection;
        var turnTextString = '';
        var turnLower = turn.toLowerCase();
        var turnSplit = turnLower.replace('_', ' ');
        street = Utils.abbrevStreetName(street);
        if (turn === 'DEPART' || index === 0) {
            turnTextString = getModeText(leg) + ' ' + direction.toLowerCase() + ' on ' + street;
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
