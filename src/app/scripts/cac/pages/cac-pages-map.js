CAC.Pages.Map = (function ($, Handlebars, _, MapControl, Routing, MockDestinations, MapTemplates) {
    'use strict';

    var defaults = {
        map: {}
    };
    var mapControl = null;
    var currentItinerary = null;

    var directions = {
        origin: null,
        destination: null
    };

    function Map(options) {
        this.options = $.extend({}, defaults, options);
    }

    Map.prototype.initialize = function () {

        // Map initialization logic and event binding
        mapControl = new MapControl();
        mapControl.plotLocations(MockDestinations);
        mapControl.locateUser();

        // Plan a trip using information provided
        $('section.directions button[type=submit]').click($.proxy(planTrip, this));

        $('select.custom-select').multipleSelect();

        $('.sidebar-search button[type="submit"]').on('click', function(){
            $('.explore').addClass('show-results');
        });

        $('.sidebar-options .view-more').click($.proxy(showOptions, this));

        $('#sidebar-toggle-directions').on('click', function(){
            $('.explore').addClass('hidden');
            $('.directions').removeClass('hidden');
        });

        $('#sidebar-toggle-explore').on('click', function(){
            $('.directions').addClass('hidden');
            $('.explore').removeClass('hidden');
        });

        this.typeahead  = new CAC.Search.Typeahead('input.typeahead');
        this.typeahead.events.on('cac:typeahead:selected', $.proxy(onTypeaheadSelected, this));
    };

    return Map;


    function showOptions() {
        var moreOpt = '.sidebar-options .more-options';

        $(moreOpt).toggleClass('active');
        $(moreOpt).parent().find('a.view-more').text(function() {
            if($(moreOpt).hasClass('active')){
                return 'View less options';
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
        var origin = directions.origin;
        var destination = directions.destination;

        Routing.planTrip(origin, destination).then(function (itineraries) {
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

    function onTypeaheadSelected(event, key, location) {
        // TODO: Deleting text from input elements does not delete directions object values
        if (key === 'destination') {
            directions.destination = [location.feature.geometry.y, location.feature.geometry.x];
        } else if (key === 'origin') {
            directions.origin = [location.feature.geometry.y, location.feature.geometry.x];
        } else if (key === 'search') {
            setAddress(location);
        }
    }

    function setAddress(location) {
        $('div.address > h4').html(MapTemplates.addressText(location.feature.attributes));
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

})(jQuery, Handlebars, _, CAC.Map.Control, CAC.Routing.Plans, CAC.Mock.Destinations, CAC.Map.Templates);
