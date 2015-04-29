
/**
 *  View control for the sidebar directions list
 *
 */
CAC.Control.DirectionsList = (function ($, Handlebars, UserPreferences, Utils) {

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

    function DirectionsListControl(params) {
        // recursively extend objects, so those not overridden will still exist
        options = $.extend(true, {}, defaults, params);

        $container = $(options.selectors.container);

        registerListItemHelpers();
    }

    DirectionsListControl.prototype = {
        events: events,
        eventNames: eventNames,
        setItinerary: setItinerary,
        show: show,
        hide: hide,
        toggle: toggle,
        shareOnFacebook: shareOnFacebook,
        shareOnGooglePlus: shareOnGooglePlus,
        shareOnTwitter: shareOnTwitter
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
        $(options.selectors.twitterShareButton).on('click', {url: directionsUrl}, shareOnTwitter);
        $(options.selectors.facebookShareButton).on('click', {url: directionsUrl}, shareOnFacebook);
        $(options.selectors.googlePlusShareButton).on('click', {url: directionsUrl}, shareOnGooglePlus);
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

    function shareOnFacebook(event) {
        if (typeof FB !== 'undefined') {
            // prompt user to log in, if they aren't already
            FB.getLoginStatus(function(response) {
                if (response.status !== 'connected') {
                    FB.login();
                }
            });

            // TODO: get a screenshot of the map page to post?
            var pictureUrl = [options.useHost,
                              '/static/images/logo_color.svg'
                             ].join('');

            FB.ui({
                method: 'feed',
                link: event.data.url,
                caption: 'Trip Plan on GoPhillyGo',
                picture: pictureUrl,
            }, function(response){
                if (!response || _.has(response, 'error_code')) {
                    console.warn(response);
                    console.warn('did not post to facebook');
                }
            });
        } else {
            console.warn('FB unavailable. Is script loaded?');
            // TODO: redirect to URL if API unavailable

            /*
            https://www.facebook.com/dialog/feed?
              app_id=145634995501895
              &display=popup&caption=An%20example%20caption
              &link=https%3A%2F%2Fdevelopers.facebook.com%2Fdocs%2F
              &redirect_uri=https://developers.facebook.com/tools/explorer
            */
        }

        event.returnValue = false;
        event.preventDefault();
    }

    function shareOnGooglePlus(event) {
        // TODO: make interactive post instead?
        // https://developers.google.com/+/web/share/interactive

        // use the share endpoint directly
        // https://developers.google.com/+/web/share/#sharelink-endpoint
        var shareUrl = 'https://plus.google.com/share';
        var params = {
            url: event.data.url
        };
        var url = shareUrl + '?' + $.param(params);
        var windowOptions = 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600';
        window.open(url, '', windowOptions);
        event.returnValue = false;
        event.preventDefault();
    }

    function shareOnTwitter(event) {
        var intentUrl = 'https://twitter.com/intent/tweet';
        var tweet = 'Test tweet';
        // @go_philly_go twitter account is "related" to tweet (might suggest to follow)
        var related ='go_philly_go:GoPhillyGo on Twitter';
        // TODO: use via?

        var tweetParams = {
            url: event.data.url,
            text: tweet,
            related: related
        };

        var url = intentUrl + '?' + $.param(tweetParams);

        // open in a popup like standard Twitter button; see 'Limited Dependencies' section here:
        // https://dev.twitter.com/web/intents

        var winWidth = screen.width;
        var winHeight = screen.height;
        var width = 550;
        var height = 420;
        var left = Math.round((winWidth / 2) - (width / 2));
        var top = 0;
        if (winHeight > height) {
            top = Math.round((winHeight / 2) - (height / 2));
        }

        var windowOptions = ['scrollbars=yes,resizable=yes,toolbar=no,location=yes',
                             ',width=', + width,
                             ',height=' + height,
                             ',left=' + left,
                             ',top=' + top
                            ].join('');

        window.open(url, 'intent', windowOptions);
        event.returnValue = false;
        event.preventDefault();
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

})(jQuery, Handlebars, CAC.User.Preferences, CAC.Utils);
