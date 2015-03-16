CAC.Pages.Map = (function ($, Handlebars, _, moment, MapControl, Routing, MockDestinations, MapTemplates, UserPreferences) {
    'use strict';

    var defaults = {
        map: {}
    };
    var mapControl = null;
    var sidebarTabControl = null;
    var currentItinerary = null;
    var datepicker = null;

    var directions = {
        exploreOrigin: null,
        origin: null,
        destination: null
    };

    function Map(options) {
        this.options = $.extend({}, defaults, options);
    }

    Map.prototype.initialize = function () {

        // Map initialization logic and event binding
        mapControl = new MapControl();
        mapControl.drawDestinations(MockDestinations);
        mapControl.locateUser();


        // Plan a trip using information provided
        $('section.directions button[type=submit]').click($.proxy(planTrip, this));

        // Show isochrone in discovery tab
        $('section.explore button[type=submit]').click($.proxy(clickedExplore, this));

        $('.sidebar-search button[type="submit"]').on('click', function(){
            $('.explore').addClass('show-results');
        });

        $('.sidebar-options .view-more').click(showOptions);

        // initiallize date/time picker
        datepicker = $('#datetimeDirections').datetimepicker({useCurrent: true});

        sidebarTabControl = new CAC.Control.SidebarTab();
        sidebarTabControl.events.on('cac:control:sidebartab:shown', $.proxy(onSidebarTabShown, this));

        this.typeahead  = new CAC.Search.Typeahead('input.typeahead');
        this.typeahead.events.on('cac:typeahead:selected', $.proxy(onTypeaheadSelected, this));

        setFromUserPreferences();
    };

    return Map;

    function showOptions(event) {
        var parent = $(event.target).closest('section');
        var moreOpt = $('.sidebar-options .more-options', parent);

        $(moreOpt).toggleClass('active');
        $(moreOpt).parent().find('a.view-more').text(function() {
            if($(moreOpt).hasClass('active')){
                return 'View fewer options';
            } else {
                return 'View more options';
            }
        });
    }

    function planTrip() {
        if (!(directions.origin && directions.destination)) {
            setDirectionsError();
            return;
        }

        var picker = $('#datetimeDirections').data('DateTimePicker');
        var date = picker.date();
        if (!date) {
            // use current date/time if none set
            date = moment();
        }

        var mode = $('#directionsModeSelector').val();

        var origin = directions.origin;
        var destination = directions.destination;
        var fromText = $('#directionsFrom').val();
        var toText = $('#directionsTo').val();

        var arriveBy = true;
        if ($('input[name="arriveBy"]:checked').val() !== 'arriveBy') {
            arriveBy = false; // depart at time instead
        }

        // set user preferences
        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('arriveBy', arriveBy);
        UserPreferences.setPreference('fromText', fromText);
        UserPreferences.setPreference('toText', toText);

        Routing.planTrip(origin, destination, date, mode, arriveBy).then(function (itineraries) {
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

            // Show the directions div and populate with itineraries
            var html = MapTemplates.itinerarySummaries(itineraries);
            $('.itineraries').html(html);
            $('a.itinerary').on('click', onItineraryClicked);
            $('.block-itinerary').on('click', onItineraryClicked);
            $('.directions').addClass('show-results');
        });
    }

    /**
     * Handles click events to highlight a given itinerary
     * Event handler, so this is set to the clicked event
     */
    function onItineraryClicked() {
        var itineraryId = this.getAttribute('data-itinerary');
        var itinerary = mapControl.getItineraryById(itineraryId);
        if (itinerary) {
            currentItinerary.highlight(false);
            itinerary.highlight(true);
            currentItinerary = itinerary;
        }
    }

    function onSidebarTabShown(event, tabId) {
        if (tabId === 'directions') {
            mapControl.setGeocodeMarker(null);
        }
    }

    function onTypeaheadSelected(event, key, location) {
        // TODO: Deleting text from input elements does not delete directions object values
        if (key === 'destination') {
            UserPreferences.setPreference('to', location);
            directions.destination = [location.feature.geometry.y, location.feature.geometry.x];
        } else if (key === 'origin') {
            UserPreferences.setPreference('from', location);
            directions.origin = [location.feature.geometry.y, location.feature.geometry.x];
        } else if (key === 'search') {
            UserPreferences.setPreference('origin', location);
            directions.exploreOrigin = [location.feature.geometry.y, location.feature.geometry.x];
            setAddress(location);
        }
    }

    function setAddress(location) {
        var latLng = L.latLng(location.feature.geometry.y, location.feature.geometry.x);
        mapControl.setGeocodeMarker(latLng);
        $('div.address > h4').html(MapTemplates.addressText(location.feature.attributes));
    }

    function setDestinationSidebar(destinations) {
        var $container = $('<div></div>').addClass('destinations');
        $.each(destinations, function (i, destination) {
            var $destination = $(CAC.Map.Templates.destinationBlock(destination));

            $destination.click(function () {
                // TODO: see issue #78 regarding refactors to improve this

                sidebarTabControl.setTab('directions');

                // Set origin
                var from = UserPreferences.getPreference('origin');
                var originText = UserPreferences.getPreference('originText');
                directions.origin = [from.feature.geometry.y, from.feature.geometry.x];
                $('section.directions input.origin').val(originText);

                // Set destination
                var toCoords = destination.point.coordinates;
                var destinationText = destination.address;
                directions.destination = [toCoords[1], toCoords[0]];
                $('section.directions input.destination').val(destinationText);

                // Get directions
                planTrip();
            });
            $container.append($destination);
        });
        $('.explore div.sidebar-details').empty().append($container);
        $('.explore .sidebar-clip').height(400);
    }

    function setDirectionsError() {
        var errorClass = 'error';
        var $inputOrigin = $('section.directions input.origin');
        var $inputDestination = $('section.directions input.destination');
        if (directions.origin) {
            $inputOrigin.removeClass(errorClass);
        } else {
            $inputOrigin.addClass(errorClass);
        }
        if (directions.destination) {
            $inputDestination.removeClass(errorClass);
        } else {
            $inputDestination.addClass(errorClass);
        }
    }

    /**
     * Set user preferences before fetching isochrone.
     */
    function clickedExplore() {
        var exploreMinutes = $('#exploreTime').val();
        var mode = $('#exploreModeSelector').val();

        // TODO: add date/time selector to 'explore' extra options panel?
        var when = moment();

        // store search inputs to preferences
        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('originText', $('#exploreOrigin').val());
        UserPreferences.setPreference('exploreTime', exploreMinutes);
        UserPreferences.setPreference('mode', mode);

        fetchIsochrone(when, mode, exploreMinutes);
    }

    /**
     * Fetch travelshed from OpenTripPlanner, then populate side bar with featured locations
     * found within the travelshed.
     *
     * @param {Object} when Moment.js time for the search (default to now)
     * @param {String} mode String for travel mode to pass to OTP (walk, transit, etc.)
     * @param {Number} exploreMinutes Number of minutes of travel for the isochrone limit
     */
    function fetchIsochrone(when, mode, exploreMinutes) {
        mapControl.fetchIsochrone(directions.exploreOrigin, when, mode, exploreMinutes).then(
            function (destinations) {
                setDestinationSidebar(destinations);
            }
        );
    }

    /**
     * When first naviagting to this page, check for user preferences to load.
     */
    function setFromUserPreferences() {
        var method = UserPreferences.getPreference('method');
        if (!method) {
            return; // no user preferences set
        }

        var mode = UserPreferences.getPreference('mode');

        if (method === 'directions') {
            // switch tabs
            sidebarTabControl.setTab('directions');

            var arriveBy = UserPreferences.getPreference('arriveBy');
            var from = UserPreferences.getPreference('from');
            var to = UserPreferences.getPreference('to');
            var fromText = UserPreferences.getPreference('fromText');
            var toText = UserPreferences.getPreference('toText');

            directions.destination = [to.feature.geometry.y, to.feature.geometry.x];

            $('section.directions input.origin').typeahead('val', fromText);
            $('section.directions input.destination').typeahead('val', toText);
            $('#directionsModeSelector').val(mode);
            $('input[name="arriveBy"]:checked').val(arriveBy);

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
        } else {
            // 'explore' tab
            var exploreOrigin = UserPreferences.getPreference('origin');
            directions.exploreOrigin = [exploreOrigin.feature.geometry.y,
                                        exploreOrigin.feature.geometry.x];
            var originText = UserPreferences.getPreference('originText');
            var exploreTime = UserPreferences.getPreference('exploreTime');
            setAddress(exploreOrigin);

            $('#exploreOrigin').typeahead('val', originText);
            $('#exploreTime').val(exploreTime);
            $('#exploreModeSelector').val(mode);

            var when = moment(); // TODO: add date/time selector for 'explore' options?

            fetchIsochrone(when, mode, exploreTime);
        }
    }

})(jQuery, Handlebars, _, moment, CAC.Map.Control, CAC.Routing.Plans, CAC.Mock.Destinations,
   CAC.Map.Templates, CAC.User.Preferences);
