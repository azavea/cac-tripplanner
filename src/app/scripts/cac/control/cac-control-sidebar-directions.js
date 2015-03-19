/**
 *  View control for the sidebar directions tab
 *
 */
CAC.Control.SidebarDirections = (function ($, Control, MapTemplates, Routing, Typeahead, UserPreferences) {

    'use strict';

    var defaults = {
        selectors: {
            bikeTriangleDiv: '#directionsBikeTriangle',
            buttonPlanTrip: 'section.directions button[type=submit]',
            checkboxArriveBy: 'input[name="arriveByDirections"]:checked',
            departAtButton: 'input[name="arriveByDirections"]:eq(1)',
            datepicker: '#datetimeDirections',
            maxWalkDiv: '#directionsMaxWalk',
            modeSelector: '#directionsModeSelector',
            itineraryList: 'section.directions .itineraries',
            typeahead: 'section.directions input.typeahead',
            origin: 'section.directions input.origin',
            destination: 'section.directions input.destination',
            wheelchairDiv: '#directionsWheelchair'
        },
        // Note:  the three bike options must sum to 1, or OTP won't plan the trip
        bikeTriangle: {
            neutral: {
                triangleSafetyFactor: 0.34,
                triangleSlopeFactor: 0.33,
                triangleTimeFactor: 0.33
            },
            flatter: {
                triangleSafetyFactor: 0.17,
                triangleSlopeFactor: 0.66,
                triangleTimeFactor: 0.17
            },
            faster: {
                triangleSafetyFactor: 0.17,
                triangleSlopeFactor: 0.17,
                triangleTimeFactor: 0.66
            },
            safer: {
                triangleSafetyFactor: 0.66,
                triangleSlopeFactor: 0.17,
                triangleTimeFactor: 0.17
            }
        }
    };
    var options = {};

    var currentItinerary = null;
    var datepicker = null;

    var directions = {
        origin: null,
        destination: null
    };

    var mapControl = null;
    var tabControl = null;
    var directionsListControl = null;
    var itineraryListControl = null;
    var typeahead = null;

    var $itineraries = null;

    function SidebarDirectionsControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;

        // Plan a trip using information provided
        $(options.selectors.buttonPlanTrip).click($.proxy(planTrip, this));

        // initiallize date/time picker
        datepicker = $(options.selectors.datepicker).datetimepicker({useCurrent: true});

        directionsListControl = new Control.DirectionsList({
            selectors: {
                container: 'section.directions .directions-list'
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
    }

    SidebarDirectionsControl.prototype = {
        setDestination: setDestination,
        setDirections: setDirections
    };

    return SidebarDirectionsControl;

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

        var arriveBy = true;
        if ($(options.selectors.checkboxArriveBy).val() === 'departAt') {
            arriveBy = false; // depart at time instead
        }

        // options to pass to OTP as-is
        var otpOptions = {
            mode: mode,
            arriveBy: arriveBy
        };

        if (mode.indexOf('BICYCLE') > -1) {
            var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
            var bikeTriangle = bikeTriangleOpt.val();
            $.extend(otpOptions, {optimize: 'TRIANGLE'}, options.bikeTriangle[bikeTriangle]);
            UserPreferences.setPreference('bikeTriangle', bikeTriangle);
        }

        // set user preferences
        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('arriveBy', arriveBy);

        Routing.planTrip(origin, destination, date, otpOptions).then(function (itineraries) {
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

            itineraryListControl.setItineraries(itineraries);
            $('.directions').addClass('show-results');
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
                console.log('no location!');
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
        var from = UserPreferences.getPreference('origin');
        var originText = UserPreferences.getPreference('originText');
        directions.origin = [from.feature.geometry.y, from.feature.geometry.x];
        $(options.selectors.origin).val(originText);

        // Set destination
        var toCoords = destination.point.coordinates;
        var destinationText = destination.address;
        directions.destination = [toCoords[1], toCoords[0]];
        $(options.selectors.destination).val(destinationText);

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
        var errorClass = 'error';
        var $input = null;
        if (key === 'origin') {
            $input = $(options.selectors.origin);
        } else {
            $input = $(options.selectors.destination);
        }

        if (directions[key]) {
            $input.removeClass(errorClass);
        } else {
            $input.addClass(errorClass);
        }
    }

    /**
     * When first navigating to this page, check for user preferences to load.
     */
    function setFromUserPreferences() {
        var method = UserPreferences.getPreference('method');
        if (method === 'directions') {

            // switch tabs
            tabControl.setTab('directions');
            var mode = UserPreferences.getPreference('mode');

            var arriveBy = UserPreferences.getPreference('arriveBy');
            var from = UserPreferences.getPreference('from');
            var to = UserPreferences.getPreference('to');
            var fromText = UserPreferences.getPreference('fromText');
            var toText = UserPreferences.getPreference('toText');

            directions.destination = [to.feature.geometry.y, to.feature.geometry.x];

            $(options.selectors.origin).typeahead('val', fromText);
            $(options.selectors.destination).typeahead('val', toText);
            $(options.selectors.modeSelector).val(mode);
            if (!arriveBy) {
                $(options.selectors.departAtButton).click();
             }

            if (from) {
                directions.origin = [from.feature.geometry.y, from.feature.geometry.x];
                planTrip();
            } else {
                // use current location if no directions origin set
                mapControl.locateUser().then(function(data) {
                    directions.origin = [data[0], data[1]];
                    planTrip();
                }, function(error) {
                    console.error('Could not geolocate user');
                    console.error(error);
                    return;
                });
            }
        }
    }

})(jQuery, CAC.Control, CAC.Map.Templates, CAC.Routing.Plans, CAC.Search.Typeahead, CAC.User.Preferences);
