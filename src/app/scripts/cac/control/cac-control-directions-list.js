
/**
 *  View control for the sidebar directions list
 *
 */
CAC.Control.DirectionsList = (function (_, $, MapTemplates) {

    'use strict';

    var defaults = {
        // Should the back button be shown in the control
        //  this is weird, ideally we would handle the back button in the wrapper view, but we
        //  need to switch out the sidebar div as a whole
        showBackButton: false,
        // Should the share button be shown in the control
        showShareButton: false,
        selectors: {
            container: '.directions-step-by-step',
            mapContainer: '.body-map',
            backButton: '.back-to-directions-results',
            directionItem: '.directions-leg .directions-step',
            directLinkButton: '.modal-list-link',
            emailShareButton: '.modal-list-email',
            facebookShareButton: '.modal-list-facebook',
            twitterShareButton: '.modal-list-twitter',
            googlePlusShareButton: '.modal-list-google',
            stepByStepClass: 'body-step-by-step',
            sidebarBannerClass: 'body-has-sidebar-banner'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        backButtonClicked: 'cac:control:directionslist:backbutton',
        listItemClicked: 'cac:control:directionslist:listitem',
        directionHovered: 'cac:control:directionslist:directionhover',
    };

    var $container = null;
    var itinerary = {};

    function DirectionsListControl(params) {
        // recursively extend objects, so those not overridden will still exist
        options = $.extend(true, {}, defaults, params);
        $container = $(options.selectors.container);
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
        if (_.includes(itinerary.modes, 'BICYCLE') && itinerary.agencies.length) {
            var $alert = MapTemplates.bicycleWarningAlert(itinerary.agencies);
            $container.append($alert);
        }

        $container.append($html);    }

    function getTemplate(itinerary) {
        var templateData = {
            showBackButton: options.showBackButton,
            showShareButton: options.showShareButton,
            id: itinerary.id,
            start: {
                text: itinerary.fromText,
                time: itinerary.startTime
            },
            end: {
                text: itinerary.toText,
                time: itinerary.endTime
            },
            legs: itinerary.legs
        };

        return MapTemplates.itinerary(templateData);
    }

    function show() {
        $(options.selectors.mapContainer).removeClass(options.selectors.sidebarBannerClass);
        $(options.selectors.mapContainer).addClass(options.selectors.stepByStepClass);
    }

    function hide() {
        $(options.selectors.mapContainer).removeClass(options.selectors.stepByStepClass);
        $(options.selectors.mapContainer).addClass(options.selectors.sidebarBannerClass);
    }

    function toggle() {
        if ($(options.selectors.mapContainer).hasClass(options.selectors.sidebarBannerClass)) {
            show();
        } else {
            hide();
        }
    }

})(_, jQuery, CAC.Map.Templates);
