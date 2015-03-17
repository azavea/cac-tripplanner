CAC.Pages.Map = (function ($, Handlebars, _, moment, MapControl, UserPreferences) {
    'use strict';

    var defaults = {
        map: {}
    };
    var mapControl = null;
    var sidebarExploreControl = null;
    var sidebarDirectionsControl = null;
    var sidebarTabControl = null;

    function Map(options) {
        this.options = $.extend({}, defaults, options);
    }

    Map.prototype.initialize = function () {

        // Map initialization logic and event binding
        mapControl = new MapControl();
        mapControl.locateUser();


        sidebarTabControl = new CAC.Control.SidebarTab();
        sidebarTabControl.events.on('cac:control:sidebartab:shown', $.proxy(onSidebarTabShown, this));

        sidebarExploreControl = new CAC.Control.SidebarExplore({
            mapControl: mapControl
        });
        sidebarExploreControl.events.on('cac:control:sidebarexplore:destinationselected', $.proxy(onDestinationSelected, this));

        sidebarDirectionsControl = new CAC.Control.SidebarDirections({
            mapControl: mapControl,
            tabControl: sidebarTabControl
        });

        this.typeahead  = new CAC.Search.Typeahead('input.typeahead');
        this.typeahead.events.on('cac:typeahead:selected', $.proxy(onTypeaheadSelected, this));
    };

    return Map;

    function onDestinationSelected(event, destination) {
        sidebarTabControl.setTab('directions');
        sidebarDirectionsControl.setDestination(destination);
    }

    function onSidebarTabShown(event, tabId) {
        if (tabId === 'directions') {
            mapControl.setGeocodeMarker(null);
        }
    }

    function onTypeaheadSelected(event, key, location) {
        // TODO: Deleting text from input elements does not delete directions object values
        if (key === 'origin' || key === 'destination') {
            var prefKey = key === 'origin' ? 'from' : 'to';
            UserPreferences.setPreference(prefKey, location);
            sidebarDirectionsControl.setDirections(key, [location.feature.geometry.y, location.feature.geometry.x]);
        } else if (key === 'search') {
            UserPreferences.setPreference('origin', location);
            sidebarExploreControl.setAddress(location);
        }
    }
})(jQuery, Handlebars, _, moment, CAC.Map.Control, CAC.User.Preferences);
