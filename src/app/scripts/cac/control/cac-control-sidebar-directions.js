/**
 *  View control for the sidebar directions tab
 *
 */
CAC.Control.SidebarDirections = (function ($, Control, BikeOptions, MapTemplates, Routing,
                                 Typeahead, UserPreferences, Utils) {

    'use strict';

    var METERS_PER_MILE = 1609.34;

    var defaults = {
        selectors: {
            arriveByButton: 'input[name="arriveByDirections"]:eq(1)',
            bikeTriangleDiv: '#directionsBikeTriangle',
            buttonPlanTrip: 'section.directions button[type=submit]',
            checkboxArriveBy: 'input[name="arriveByDirections"]:checked',
            datepicker: '#datetimeDirections',
            destination: 'section.directions input.destination',
            directions: '.directions',
            errorClass: 'error',
            itineraryList: 'section.directions .itineraries',
            maxWalkDiv: '#directionsMaxWalk',
            modeSelector: '#directionsModeSelector',
            origin: 'section.directions input.origin',
            resultsClass: 'show-results',
            spinner: 'section.directions div.sidebar-details > .sk-spinner',
            typeahead: 'section.directions input.typeahead',
            wheelchairDiv: '#directionsWheelchair'
        }
    };
    var options = {};

    var currentItinerary = null;
    var datepicker = null;

    var directions = {
        origin: null,
        destination: null
    };

    var bikeOptions = null;
    var mapControl = null;
    var tabControl = null;
    var directionsListControl = null;
    var itineraryListControl = null;
    var typeahead = null;

    function SidebarDirectionsControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;
        bikeOptions = new BikeOptions();

        // Plan a trip using information provided
        $(options.selectors.buttonPlanTrip).click($.proxy(planTrip, this));

        $(options.selectors.modeSelector).change($.proxy(changeMode, this));

        // initiallize date/time picker
        datepicker = $(options.selectors.datepicker).datetimepicker({useCurrent: true});

        directionsListControl = new Control.DirectionsList({
            showBackButton: true,
            showShareButton: true,
            selectors: {
                container: 'section.directions .directions-list',
                backButton: 'a.back',
                shareButton: 'a.share'
            }
        });
        directionsListControl.events.on('cac:control:directionslist:backbutton', onDirectionsBackClicked);

        itineraryListControl = new Control.ItineraryList({
            selectors: {
                container: 'section.directions .itineraries'
            }
        });
        itineraryListControl.events.on('cac:control:itinerarylist:itineraryclicked', onItineraryClicked);

        typeahead  = new Typeahead(options.selectors.typeahead);
        typeahead.events.on('cac:typeahead:selected', onTypeaheadSelected);

        setFromUserPreferences();
        changeMode();
    }

    SidebarDirectionsControl.prototype = {
        clearDirections: clearDirections,
        setDestination: setDestination,
        setDirections: setDirections
    };

    return SidebarDirectionsControl;

    function changeMode() {
        bikeOptions.changeMode(options.selectors);
    }

    function clearDirections() {
        mapControl.setOriginDestinationMarkers(null, null);
        mapControl.clearItineraries();
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.directions).removeClass(options.selectors.resultsClass);
    }

    function planTrip() {
        if (!(directions.origin && directions.destination)) {
            setDirectionsError('origin');
            setDirectionsError('destination');
            return;
        }

        var picker = $(options.selectors.datepicker).data('DateTimePicker');
        var date = picker.date();
        if (!date) {
            // use current date/time if none set
            date = moment();
        }

        var mode = $(options.selectors.modeSelector).val();
        var origin = directions.origin;
        var destination = directions.destination;

        var arriveBy = false; // depart at time by default
        if ($(options.selectors.checkboxArriveBy).val() === 'arriveBy') {
            arriveBy = true;
        }

        // options to pass to OTP as-is
        var otpOptions = {
            mode: mode,
            arriveBy: arriveBy
        };

        if (mode.indexOf('BICYCLE') > -1) {
            var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
            var bikeTriangle = bikeTriangleOpt.val();
            $.extend(otpOptions, {optimize: 'TRIANGLE'}, bikeOptions.options.bikeTriangle[bikeTriangle]);
            UserPreferences.setPreference('bikeTriangle', bikeTriangle);
        } else {
            var maxWalk = $('input', options.selectors.maxWalkDiv).val();
            if (maxWalk) {
                UserPreferences.setPreference('maxWalk', maxWalk);
                $.extend(otpOptions, { maxWalkDistance: maxWalk * METERS_PER_MILE });
            } else {
                UserPreferences.setPreference('maxWalk', undefined);
            }

            // true if box checked
            var wheelchair = $('input', options.selectors.wheelchairDiv).prop('checked');
            UserPreferences.setPreference('wheelchair', wheelchair);
            $.extend(otpOptions, { wheelchair: wheelchair });
        }

        // set user preferences
        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('arriveBy', arriveBy);

        // show spinner while loading
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.spinner).removeClass('hidden');

        Routing.planTrip(origin, destination, date, otpOptions).then(function (itineraries) {
            $(options.selectors.spinner).addClass('hidden');
            if (!tabControl.isTabShowing('directions')) {
                // if user has switched away from the directions tab, do not show trip
                return;
            }
            // Add the itineraries to the map, highlighting the first one
            var highlight = true;
            mapControl.clearItineraries();
            _.forIn(itineraries, function (itinerary) {
                mapControl.plotItinerary(itinerary);
                itinerary.highlight(highlight);
                if (highlight) {
                    currentItinerary = itinerary;
                    highlight = false;
                }
            });

            // put markers at start and end
            mapControl.setOriginDestinationMarkers(directions.origin, directions.destination);

            // Update map bounds
            mapControl.setBounds(currentItinerary.getBounds(0.1));

            itineraryListControl.setItineraries(itineraries);
            $(options.selectors.directions).addClass(options.selectors.resultsClass);
            itineraryListControl.show();
        }, function (error) {
            $(options.selectors.spinner).addClass('hidden');
            mapControl.setOriginDestinationMarkers(null, null);
            mapControl.clearItineraries();
            itineraryListControl.setItinerariesError(error);
            $(options.selectors.directions).addClass(options.selectors.resultsClass);
            itineraryListControl.show();
        });
    }

    function onDirectionsBackClicked() {
        directionsListControl.hide();
        itineraryListControl.show();
    }

    /**
     * Handles click events to highlight a given itinerary
     */
    function onItineraryClicked(event, itinerary) {
        if (itinerary) {
            currentItinerary.highlight(false);
            itinerary.highlight(true);
            currentItinerary = itinerary;

            directionsListControl.setItinerary(itinerary);

            itineraryListControl.hide();
            directionsListControl.show();
        }
    }

    function onTypeaheadSelected(event, key, location) {
        // TODO: Deleting text from input elements does not delete directions object values
        if (key === 'origin' || key === 'destination') {
            var prefKey = key === 'origin' ? 'from' : 'to';

            if (!location) {
                UserPreferences.setPreference(prefKey, undefined);
                setDirections(key, null);
                return;
            }

            // save text for address to preferences
            UserPreferences.setPreference(prefKey, location);
            UserPreferences.setPreference(prefKey + 'Text', location.name);
            setDirections(key, [location.feature.geometry.y, location.feature.geometry.x]);
        } else {
            console.error('unrecognized key in onTypeaheadSelected: ' + key);
        }
    }

    // called when going to show directions from 'explore' origin to a selected feature
    function setDestination(destination) {
        // Set origin
        var origin = UserPreferences.getPreference('origin');
        var originText = UserPreferences.getPreference('originText');
        directions.origin = [origin.feature.geometry.y, origin.feature.geometry.x];

        // Set destination
        var toCoords = destination.point.coordinates;
        var destinationText = destination.address;
        directions.destination = [toCoords[1], toCoords[0]];

        // set in UI
        var mode = UserPreferences.getPreference('mode');
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        $(options.selectors.origin).typeahead('val', originText);
        $(options.selectors.destination).typeahead('val', destinationText);
        $(options.selectors.modeSelector).val(mode);
        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        // Save selections to user preferences
        UserPreferences.setPreference('from', origin);
        UserPreferences.setPreference('fromText', originText);
        UserPreferences.setPreference('to', Utils.convertDestinationToFeature(destination));
        UserPreferences.setPreference('toText', destinationText);

        // Get directions
        planTrip();
    }

    function setDirections(key, value) {
        if (key === 'origin' || key === 'destination') {
            directions[key] = value;
            setDirectionsError(key);
        } else {
            console.error('Directions key ' + key + 'unrecognized!');
        }
    }

    function setDirectionsError(key) {
        var $input = null;
        if (key === 'origin') {
            $input = $(options.selectors.origin);
        } else {
            $input = $(options.selectors.destination);
        }

        if (directions[key]) {
            $input.removeClass(options.selectors.errorClass);
        } else {
            $input.addClass(options.selectors.errorClass);
        }
    }

    /**
     * When first navigating to this page, check for user preferences to load.
     */
    function setFromUserPreferences() {
        var method = UserPreferences.getPreference('method');
        var mode = UserPreferences.getPreference('mode');
        var arriveBy = UserPreferences.getPreference('arriveBy');
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        var from = UserPreferences.getPreference('from');
        var to = UserPreferences.getPreference('to');
        var fromText = UserPreferences.getPreference('fromText');
        var toText = UserPreferences.getPreference('toText');
        var maxWalk = UserPreferences.getPreference('maxWalk');
        var wheelchair = UserPreferences.getPreference('wheelchair');

        if (wheelchair) {
            $('input', options.selectors.wheelchairDiv).click();
        }

        if (maxWalk) {
            $('input', options.selectors.maxWalkDiv).val(maxWalk);
        }

        directions.destination = [to.feature.geometry.y, to.feature.geometry.x];

        $(options.selectors.origin).typeahead('val', fromText);
        $(options.selectors.destination).typeahead('val', toText);
        $(options.selectors.modeSelector).val(mode);
        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        if (arriveBy) {
            $(options.selectors.arriveByButton).click();
         }

        if (method === 'directions') {
            // switch tabs
            tabControl.setTab('directions');
        }

        if (from) {
            directions.origin = [from.feature.geometry.y, from.feature.geometry.x];
            if (method === 'directions') {
                planTrip();
            }
        } else if (method === 'directions') {
            // use current location if no directions origin set
            mapControl.locateUser().then(function(data) {
                directions.origin = [data[0], data[1]];
                setDirectionsError('origin');
                planTrip();
            }, function(error) {
                console.error('Could not geolocate user');
                console.error(error);
                return;
            });
        }
    }

})(jQuery, CAC.Control, CAC.Control.BikeOptions, CAC.Map.Templates, CAC.Routing.Plans,
   CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
