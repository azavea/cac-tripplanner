
/**
 *  View control for the sidebar directions list
 *
 */
CAC.Control.DirectionsList = (function (_, $, ShareModal, MapTemplates) {

    'use strict';

    var defaults = {
        // Should the back button be shown in the control
        //  this is weird, ideally we would handle the back button in the wrapper view, but we
        //  need to switch out the sidebar div as a whole
        showBackButton: false,
        // Should the share button be shown in the control
        showShareButton: false,
        selectors: {
            alertCloseButton: '.close',
            container: '.directions-step-by-step',
            mapContainer: '.body-map',
            backButton: '.back-to-directions-results',
            directionItem: '.directions-leg .directions-step',
            directionsHeader: '.step-by-step-header',
            directLinkButton: '.modal-list-link',
            emailShareButton: '.modal-list-email',
            facebookShareButton: '.modal-list-facebook',
            twitterShareButton: '.modal-list-twitter',
            googlePlusShareButton: '.modal-list-google',
            shareModalButton: '.share-directions',
            stepByStepClass: 'body-step-by-step',
            sidebarBannerClass: 'body-has-sidebar-banner',
            activeSidebarBanner: '.sidebar-banner:not(.hidden)'
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
        $container.append($html);

        // listen to share button
        // (unnecessary to un-bind, since html gets replaced with itinerary)
        $container.find(options.selectors.shareModalButton).on('click', function() {
            new ShareModal({}).open();
        });

        // Show alert with link to transit agency bicycle policy for bike+transit itineraries
        var alert;
        if (_.includes(itinerary.modes, 'BICYCLE') && itinerary.agencies.length) {
            alert = MapTemplates.bicycleWarningAlert(itinerary.agencies);
        } else if (itinerary.agencies.length) {
            alert = MapTemplates.transitWarningAlert();
        }

        if (alert) {
            var $alert = $(alert);
            $alert.one('click', options.selectors.alertCloseButton, function () {
                $alert.remove();
            });
            $container.find(options.selectors.directionsHeader).after($alert);
        }
    }

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
            legs: itinerary.legs,
            formattedDistance: itinerary.formattedDistance,
            formattedDuration: itinerary.formattedDuration,
            showSummaryModes: itinerary.showSummaryModes,
            modeSummaries: itinerary.modeSummaries
        };

        return MapTemplates.itinerary(templateData);
    }

    function show() {
        $(options.selectors.mapContainer).removeClass(options.selectors.sidebarBannerClass);
        $(options.selectors.mapContainer).addClass(options.selectors.stepByStepClass);
    }

    function hide() {
        $(options.selectors.mapContainer).removeClass(options.selectors.stepByStepClass);
        // The spacing of the sidebar depends on the body div having a class indicating the
        // presence of a banner in the sidebar. Most of the pieces are a few layers up in Home,
        // so this uses a selector to figure out if there is an active sidebar and set the class.
        if ($(options.selectors.mapContainer).find(options.selectors.activeSidebarBanner).length > 0) {
            $(options.selectors.mapContainer).addClass(options.selectors.sidebarBannerClass);
        }
    }

})(_, jQuery, CAC.Share.ShareModal, CAC.Map.Templates);
