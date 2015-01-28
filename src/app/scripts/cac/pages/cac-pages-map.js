CAC.Pages.Map = (function ($, Handlebars, MapControl, Routing, MockDestinations, MapTemplates) {
    'use strict';

    var defaults = {
        map: {}
    };
    var mapControl = null;

    function Map(options) {
        this.options = $.extend({}, defaults, options);
    }

    Map.prototype.initialize = function () {

        // Map initialization logic and event binding
        mapControl = new MapControl();
        mapControl.plotLocations(MockDestinations);
        mapControl.locateUser();
        mapControl.events.on('MOS.Map.Control.CurrentLocationClicked', function(e, lat, lng) {
            var coords = lat + ',' + lng;
            $('section.directions input.origin').val(coords);
        });
        mapControl.events.on('MOS.Map.Control.DestinationClicked', function(e, feature) {
            var coords = feature.geometry.coordinates[1] + ',' + feature.geometry.coordinates[0];
            $('section.directions input.destination').val(coords);
        });


        /**
         * Handles click events to highlight a given itinerary
         */
        function itineraryHandler( event ) {
            var itineraryId = this.getAttribute("data-itinerary");
            Routing.setItineraryStyles(itineraryId);
        }

        /**
         * Populates sidebar with itinerary summaries
         */
        mapControl.events.on('CAC.Map.Control.ItinerariesReturned', function(e, itineraries) {
            var html = MapTemplates.itinerarySummaries(itineraries);
            $('.itineraries').html(html);
            $('a.itinerary').on("click", itineraryHandler);
            $('.block-itinerary').on("click", itineraryHandler);
        });

        // Plan a trip using information provided
        $('section.directions button[type=submit]').click($.proxy(planTrip, this));

        $('select').multipleSelect();

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
        var origin = $('section.directions input.origin').val();
        var destination= $('section.directions input.destination').val();
        mapControl.planTrip(origin, destination).then(function() {
            $('.directions').addClass('show-results');
        });
    }

})(jQuery, Handlebars, CAC.Map.Control, CAC.Routing.Plans, CAC.Mock.Destinations, CAC.Map.Templates);
