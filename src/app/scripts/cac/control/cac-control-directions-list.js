
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
            shareButton: 'a.share',
            directionItem: '.direction-item'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        backButtonClicked: 'cac:control:directionslist:backbutton',
        shareButtonClicked: 'cac:control:directionslist:sharebutton',
        listItemClicked: 'cac:control:directionslist:listitem',
        directionHovered: 'cac:control:directionslist:directionhover'
    };

    var $container = null;
    var itinerary = {};

    function DirectionsListControl(params) {
        options = $.extend({}, defaults, params);

        $container = $(options.selectors.container);

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

        var $html = $(getTemplate(itinerary));

        if (options.showBackButton) {
            $html.find(options.selectors.backButton).on('click', function () {
                events.trigger(eventNames.backButtonClicked);
            });
        }
        if (options.showShareButton) {
            $html.find(options.selectors.shareButton).on('click', function () {
                events.trigger(eventNames.shareButtonClicked);

                // Note: this code is only here temporarily to demonstrate the directions page
                var paramString = decodeURIComponent($.param(newItinerary.requestParameters));
                var index = newItinerary.id;
                var directionsUrl = '/directions/?' + paramString + '&itineraryIndex=' + index;
                window.open(directionsUrl, '_blank');
            });
        }

        // Wire up hover events on step-by-step directions
        $($html, options.selectors.directionItem)
            .mouseenter(function () {
                var lon = $(this).data('lon');
                var lat = $(this).data('lat');
                if (lon && lat) {
                    events.trigger(eventNames.directionHovered, [lon, lat]);
                }
            })
            .mouseleave(function () {
                events.trigger(eventNames.directionHovered, null);
            });

        $container.empty().append($html);
    }

    function getTemplate(itinerary) {
        var templateData = {
            start: {
                text:  UserPreferences.getPreference('fromText'),
                time: new Date(itinerary.startTime).toLocaleTimeString()
            },
            end: {
                text:  UserPreferences.getPreference('toText'),
                time: new Date(itinerary.endTime).toLocaleTimeString()
            },
            steps: itinerary.steps
        };

        // The &nbsp;'s are used instead of 'hide' classes because of some styling-related issues
        var source = [
            '<div class="block block-step">',
                '<div class="col-xs-6">',
                    '<a class="back">' + (options.showBackButton ? 'Back' : '&nbsp;') + '</a>',
                '</div>',
                '<div class="col-xs-6">',
                    '<a class="share">' + (options.showShareButton ? 'Share' : '&nbsp;') + '</a>',
                '</div>',
            '</div>',
            '<div class="block block-step">',
                '<p>Starting at <strong>{{data.start.text}} at {{data.start.time}}</strong></p>',
            '</div>',
            '{{#each data.steps}}',
            '<div class="block block-step direction-item"',
                ' data-lat="{{ lat }}" data-lon="{{ lon }}" >',
                '<div class="col-xs-3">',
                    '{{ directionIcon this.relativeDirection }}',
                '</div>',
                '<div class="col-xs-9">',
                    '{{ directionText }}',
                '</div>',
            '</div>',
            '{{/each}}',
            '<div class="block block-step">',
                '<p>Arrive at <strong>{{data.end.text}} at {{data.end.time}}</strong></p>',
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
            return new Handlebars.SafeString('<span class="glyphicon '+ getTurnIconName(direction) + '"></span>');
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
