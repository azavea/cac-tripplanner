
/**
 *  View control for the sidebar directions list
 *
 */
CAC.Control.DirectionsList = (function ($, Handlebars, Social, UserPreferences, Utils) {

    'use strict';

    var defaults = {
        // Should the back button be shown in the control
        //  this is weird, ideally we would handle the back button in the wrapper view, but we
        //  need to switch out the sidebar div as a whole
        showBackButton: false,
        // Should the share button be shown in the control
        showShareButton: false,
        selectors: {
            container: '.directions-list',
            backButton: 'a.back',
            directionItem: '.direction-item',
            facebookShareButton: '#fbShareBtn',
            twitterShareButton: '#twShareBtn',
            googlePlusShareButton: '#gpShareBtn'
        },
        useHost: window.location.protocol + '//' + window.location.host
    };
    var options = {};

    var events = $({});
    var eventNames = {
        backButtonClicked: 'cac:control:directionslist:backbutton',
        listItemClicked: 'cac:control:directionslist:listitem',
        directionHovered: 'cac:control:directionslist:directionhover'
    };

    var $container = null;
    var itinerary = {};
    var socialSharing = null;

    function DirectionsListControl(params) {
        // recursively extend objects, so those not overridden will still exist
        options = $.extend(true, {}, defaults, params);

        $container = $(options.selectors.container);

        socialSharing = new Social();

        registerListItemHelpers();
    }

    DirectionsListControl.prototype = {
        events: events,
        eventNames: eventNames,
        setItinerary: setItinerary,
        show: show,
        hide: hide,
        toggle: toggle
    };

    return DirectionsListControl;

    /**
     * Set the directions list from an OTP itinerary object
     *
     * Pulls the start/end text from UserPreference fromText and toText keys,
     * ensure that these are set
     *
     * @param {[object]} itinerary An instance of Itinerary in cac-routing-itinerary
     */
    function setItinerary(newItinerary) {
        itinerary = newItinerary;

        var template = getTemplate(itinerary);
        var $html = $(template);

        if (options.showBackButton) {
            $html.find(options.selectors.backButton).on('click', function () {
                events.trigger(eventNames.backButtonClicked);
            });
        }

        // Wire up hover events on step-by-step directions
        $html.find(options.selectors.directionItem)
            .mouseenter(function (e) {
                var lon = $(this).data('lon');
                var lat = $(this).data('lat');
                if (lon && lat) {
                    events.trigger(eventNames.directionHovered, [lon, lat]);
                }
                e.stopPropagation();
            })
            .mouseleave(function (e) {
                events.trigger(eventNames.directionHovered, null);
                e.stopPropagation();
            });

        $container.empty().append($html);

        // get URL for sharing
        var paramString = decodeURIComponent($.param(itinerary.requestParameters));
        var index = itinerary.id;
        var directionsUrl = [options.useHost,
                             '/directions/?',
                             paramString,
                             '&itineraryIndex=',
                             index
                            ].join('');
        directionsUrl = encodeURI(directionsUrl);

        // click handlers for social sharing
        $(options.selectors.twitterShareButton).on('click',
                                                   {url: directionsUrl},
                                                   socialSharing.shareOnTwitter);
        $(options.selectors.facebookShareButton).on('click',
                                                    {url: directionsUrl},
                                                    socialSharing.shareOnFacebook);
        $(options.selectors.googlePlusShareButton).on('click',
                                                      {url: directionsUrl},
                                                      socialSharing.shareOnGooglePlus);
    }

    function getTemplate(itinerary) {
        Handlebars.registerHelper('modeIcon', function(modeString) {
            return new Handlebars.SafeString(Utils.modeStringHelper(modeString));
        });

        Handlebars.registerHelper('datetime', function(dateTime) {
            return new Handlebars.SafeString(new Date(dateTime).toLocaleTimeString());
        });

        Handlebars.registerHelper('inMiles', function(meters) {
            return new Handlebars.SafeString(Math.round(((meters / 1000) * 0.621371) * 100) / 100);
        });

        var templateData = {
            showBackButton: options.showBackButton,
            showShareButton: options.showShareButton,
            start: {
                text:  UserPreferences.getPreference('fromText'),
                time: itinerary.startTime
            },
            end: {
                text:  UserPreferences.getPreference('toText'),
                time: itinerary.endTime
            },
            legs: itinerary.legs
        };

        // The &nbsp;'s are used instead of 'hide' classes because of some styling-related issues
        var source = [
            '<div class="block block-step directions-header">',
                'Directions',
                '{{#if data.showBackButton}}<div class="pull-right"><a class="back pull-right">',
                 '<i class="md md-close"></i></a></div>{{/if}}',
                '<div class="pull-right dropdown">{{#if data.showShareButton}}',
                    '<a class="share dropdown-toggle" data-toggle="dropdown">',
                    '<i class="md md-share"></i></a>',
                    '<ul class="dropdown-menu">',
                        '<li><a id="twShareBtn" title="Twitter" data-toggle="tooltip"',
                            'data-target="#" <i class="fa fa-2x fa-twitter-square"></i>',
                        '</a></li>',
                        '<li><a id="fbShareBtn" title="Facebook" data-toggle="tooltip" ',
                            'data-target="#" <i class="fa fa-2x fa-facebook-official"></i>',
                        '</a></li>',
                        '<li><a id="gpShareBtn" title="Google+" data-toggle="tooltip" ',
                            'data-target="#" <i class="fa fa-2x fa-google-plus"></i>',
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
                            '<div class="direction-section"><table><tr><td class="direction-icon">',
                            '{{modeIcon this.mode}}</td><td class="direction-text direction-item"',
                            ' data-lat="{{this.from.lat}}" data-lon="{{this.from.lon}}" >',
                            '{{#if this.transitLeg}}{{this.agencyName}} {{this.route}} ',
                                '{{this.headsign}}{{/if}} ',
                            'to {{this.to.name}}</td></tr></table></div>',
                            '<div class="block direction-item"',
                            ' data-lat="{{this.from.lat}}" data-lon="{{this.from.lon}}" >',
                                '{{#each steps}}',
                                    '<div class="block block-step direction-item"',
                						' data-lat="{{ lat }}" data-lon="{{ lon }}" >',
                                        '<tr>',
                                            '<td>',
                                                '{{ directionText }}',
                                            '</td>',
                                        '</tr>',
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

    function show() {
        $container.removeClass('hidden');
    }

    function hide() {
        $container.addClass('hidden');
    }

    function toggle() {
        if ($container.hasClass('hidden')) {
            show();
        } else {
            hide();
        }
    }

    function registerListItemHelpers() {
        // Only register these once, when the control loads
        Handlebars.registerHelper('directionIcon', function(direction) {
            return new Handlebars.SafeString('<span class="glyphicon '+
                                             getTurnIconName(direction) + '"></span>');
        });
        Handlebars.registerHelper('directionText', function () {
            var text = turnText(this.relativeDirection, this.streetName, this.absoluteDirection);
            return new Handlebars.SafeString('<span>' + text + '</span>');
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

})(jQuery, Handlebars, CAC.Share.Social, CAC.User.Preferences, CAC.Utils);
