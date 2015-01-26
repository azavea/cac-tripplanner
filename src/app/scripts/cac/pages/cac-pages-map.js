CAC.Pages.Map = (function ($, MapControl, MapRouting, MockDestinations) {
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

        // Register events to catch location clicks and autocomplete direction dialog
        $(document).bind('MOS.Map.Control.CurrentLocationClicked', function(e, lat, lng) {
            var coords = lat + ',' + lng;
            $('section.directions input.origin').val(coords);
        });
        $(document).bind('MOS.Map.Control.DestinationClicked', function(e, feature) {
            var coords = feature.geometry.coordinates[1] + ',' + feature.geometry.coordinates[0];
            $('section.directions input.destination').val(coords);
        });

        // Plan a trip using information provided
        $('section.directions button[type=submit]').click(function() {
            var origin = $('section.directions input.origin').val();
            var destination= $('section.directions input.destination').val();
            MapRouting.planTrip(origin, destination).then(function(d){
              console.log(d);
            });
        });

        $('select').multipleSelect();

        $('.sidebar-search button[type="submit"]').on('click', function(){
            $('.explore').addClass('show-results');
        });

        $('.sidebar-options .view-more').on('click', function(){
            var moreOpt = '.sidebar-options .more-options';

            $(moreOpt).toggleClass('active');
            if($(moreOpt).hasClass('active')){
                $(this).text('View less options');
            } else {
                $(this).text('View more options');
            }
        });

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

})(jQuery, CAC.Map.Control, CAC.Map.Routing, CAC.Mock.Destinations);
