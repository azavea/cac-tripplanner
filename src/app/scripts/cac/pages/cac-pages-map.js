CAC.Pages.Map = (function ($, Handlebars, _, moment, MapControl, UserPreferences, UrlRouter) {
    'use strict';

    var defaults = {
        map: {},
        selectors: {
            leafletPopups: 'a.leaflet-popup-close-button'
        }
    };

    var mapControl = null;
    var sidebarExploreControl = null;
    var directionsControl = null;
    var sidebarTabControl = null;
    var urlRouter = null;

    function Map(options) {
        this.options = $.extend({}, defaults, options);
    }

    Map.prototype.initialize = function () {
        urlRouter = new UrlRouter();

        sidebarTabControl = new CAC.Control.SidebarTab();
        window.stc = sidebarTabControl;
        sidebarTabControl.events.on(sidebarTabControl.eventNames.tabShown,
                                    $.proxy(onSidebarTabShown, this));

        // Map initialization logic and event binding
        mapControl = new MapControl({
            tabControl: sidebarTabControl
        });

        mapControl.events.on(mapControl.eventNames.destinationPopupClick,
                             $.proxy(getDestinationDirections, this));

        mapControl.events.on(mapControl.eventNames.originMoved,
                             $.proxy(moveOrigin, this));

        mapControl.events.on(mapControl.eventNames.destinationMoved,
                             $.proxy(moveDestination, this));

        mapControl.events.on(mapControl.eventNames.geocodeMarkerMoved,
                             $.proxy(moveIsochrone, this));

        sidebarExploreControl = new CAC.Control.SidebarExplore({
            mapControl: mapControl,
            tabControl: sidebarTabControl,
            urlRouter: urlRouter
        });
        sidebarExploreControl.events.on(sidebarExploreControl.eventNames.destinationDirections,
                                        $.proxy(getDestinationDirections, this));

        directionsControl = new CAC.Control.Directions({
            mapControl: mapControl,
            tabControl: sidebarTabControl,
            urlRouter: urlRouter
        });
    };

    return Map;

    // featured destination select
    function getDestinationDirections(event, destination) {

        // check user agent to see if mobile device; if so, redirect to Google Maps
        var regex = /android|iphone|ipod/i;
        var userAgent = navigator.userAgent.toLowerCase();
        var uaMatch = userAgent.match(regex);
        var mobileDevice = uaMatch ? uaMatch[0] : false;

        // Tablets go to full site. Check if Android devices are tablets:
        // no 'mobile' in user agent, or screen width >= bootstrap md breakpoint (992px)
        if (mobileDevice === 'android' && (!userAgent.match(/mobile/i) || screen.width >= 992)) {
            mobileDevice = false;
        }

        if (mobileDevice) {
            var addr = [destination.address, destination.city, destination.state].join(', ');
            var url = ['https://maps.google.com/maps?saddr=Current+Location',
                       '&dirflg=r&daddr=', // default to transit mode with dirflg
                       encodeURIComponent(addr)
                       ].join('');
            window.location = url;
            return false;
        }

        // not a mobile device; go to directions tab
        mapControl.isochroneControl.clearIsochrone();
        directionsControl.clearDirections();
        mapControl.setGeocodeMarker(null);
        directionsControl.setDestination(destination);
        sidebarTabControl.setTab('directions');
    }

    function moveOrigin(event, position) {
        directionsControl.moveOriginDestination('origin', position);
    }

    function moveDestination(event, position) {
        directionsControl.moveOriginDestination('destination', position);
    }

    function moveIsochrone(event, position) {
        sidebarExploreControl.movedPoint(position);
    }

    function onSidebarTabShown(event, tabId) {
        urlRouter.clearUrl();

        // close any open map popups on tab switch
        _.each($(this.options.selectors.leafletPopups), function(closeBtn) {
            closeBtn.click();
        });

        // Load user preferences on tab switch in order to easily keep the pages in sync
        if (tabId === 'directions') {
            UserPreferences.setPreference('method', 'directions');
            mapControl.isochroneControl.clearIsochrone();
            mapControl.setGeocodeMarker(null);
            if (directionsControl) {
                directionsControl.setFromUserPreferences();
            }
        } else {
            UserPreferences.setPreference('waypoints', undefined);
            UserPreferences.setPreference('method', 'explore');
            directionsControl.clearDirections();
            sidebarExploreControl.setFromUserPreferences();
        }
    }

})(jQuery, Handlebars, _, moment, CAC.Map.Control, CAC.User.Preferences, CAC.UrlRouting.UrlRouter);
