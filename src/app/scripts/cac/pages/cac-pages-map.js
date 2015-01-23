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

        $(document).bind('MOS.Map.Control.DestinationClicked', function(e, feature) {
            var coords = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
            console.log('This is ', feature.properties.name,
                        ', and it lives at', coords);
            mapControl.locateUser().then(function(data) {
                MapRouting.planTrip(data, coords).then(function(d){console.log(d)});

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
