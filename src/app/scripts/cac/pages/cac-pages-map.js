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
        mapControl.events.on('MOS.Map.Control.CurrentLocationClicked', function(e, lat, lng) {
            var coords = lat + ',' + lng;
            $('section.directions input.origin').val(coords);
        });
        mapControl.events.on('MOS.Map.Control.DestinationClicked', function(e, feature) {
            var coords = feature.geometry.coordinates[1] + ',' + feature.geometry.coordinates[0];
            $('section.directions input.destination').val(coords);
        });

        // Plan a trip using information provided
        $('section.directions button[type=submit]').click($.proxy(logTrip, this));

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
    function logTrip() {
        var origin = $('section.directions input.origin').val();
        var destination= $('section.directions input.destination').val();
        MapRouting.planTrip(origin, destination).then(function(d){
          console.log(d);
        });
    }

})(jQuery, CAC.Map.Control, CAC.Map.Routing, CAC.Mock.Destinations);
