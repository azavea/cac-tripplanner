
/**
 *  View control for the sidebar directions list
 *
 */
CAC.Control.DirectionsList = (function (_, $, MapTemplates, Social, UserPreferences) {

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
            directLinkButton: '#directLinkBtn',
            emailShareButton: '#emailShareBtn',
            facebookShareButton: '#fbShareBtn',
            twitterShareButton: '#twShareBtn',
            googlePlusShareButton: '#gpShareBtn'
        }
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
     * Pulls the start/end text from UserPreference originText and destinationText keys,
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

        $container.empty();

        // Show alert with link to transit agency bicycle policy for bike+transit itineraries
        if (_.contains(itinerary.modes, 'BICYCLE') && itinerary.agencies.length) {
            var $alert = MapTemplates.bicycleWarningAlert(itinerary.agencies);
            $container.append($alert);
        }

        $container.append($html);

        // get URL for sharing
        var paramString = decodeURIComponent($.param(itinerary.requestParameters));
        var index = itinerary.id;
        var directionsUrl = ['/directions/?',
                             paramString,
                             '&itineraryIndex=',
                             index,
                             '&fromText=',
                             UserPreferences.getPreference('originText'),
                             '&toText=',
                             UserPreferences.getPreference('destinationText')
                            ].join('');
        directionsUrl = encodeURI(directionsUrl);

        socialSharing.shortenLink(directionsUrl).then(function(shortened) {
            // set up click handlers for social sharing with shortened link
            $(options.selectors.twitterShareButton).on('click',
                                                       {url: shortened},
                                                       socialSharing.shareOnTwitter);
            $(options.selectors.facebookShareButton).on('click',
                                                        {url: shortened},
                                                        socialSharing.shareOnFacebook);
            $(options.selectors.googlePlusShareButton).on('click',
                                                          {url: shortened},
                                                          socialSharing.shareOnGooglePlus);
            $(options.selectors.emailShareButton).on('click',
                                                     {url: shortened},
                                                     socialSharing.shareViaEmail);
            $(options.selectors.directLinkButton).on('click',
                                                     {url: shortened},
                                                     socialSharing.shareDirectLink);
        });
    }

    function getTemplate(itinerary) {
        var templateData = {
            showBackButton: options.showBackButton,
            showShareButton: options.showShareButton,
            start: {
                text:  UserPreferences.getPreference('originText'),
                time: itinerary.startTime
            },
            end: {
                text:  UserPreferences.getPreference('destinationText'),
                time: itinerary.endTime
            },
            legs: itinerary.legs
        };

        return MapTemplates.itinerary(templateData);
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

})(_, jQuery, CAC.Map.Templates, CAC.Share.Social, CAC.User.Preferences);
