CAC.Pages.Directions = (function ($, _, DirectionsList, Itinerary, Settings, Utils) {
    'use strict';

    var defaults = {
        selectors: {
            directionsContainer: '.directions-list'
        }
    };

    function Directions(options) {
        this.options = $.extend({}, defaults, options);
    }

    Directions.prototype.initialize = function () {
        var params = Utils.getUrlParams();
        if (!_.has(params, 'itineraryIndex')) {
            // TODO: show this error in the UI
            console.error('Must specify itineraryIndex URL parameter');
            return;
        }
        var itineraryIndex = params.itineraryIndex;

        // itineraryIndex is the only parameter not intended for OTP
        delete params.itineraryIndex;

        var directionsListControl = new DirectionsList({
            showBackButton: false,
            showShareButton: false,
            selectors: {
                container: this.options.selectors.directionsContainer
            }
        });

        $.ajax({
            url: Settings.routingUrl,
            type: 'GET',
            crossDomain: true,
            data: params
        }).then(function(data) {
            var itineraries = data.plan.itineraries;
            var params = data.requestParameters;
            var itinerary = new Itinerary(itineraries[itineraryIndex], itineraryIndex, params);
            directionsListControl.setItinerary(itinerary);
        }, function (error) {
            console.log('error: ', error);
        });
    };

    return Directions;

})(jQuery, _, CAC.Control.DirectionsList, CAC.Routing.Itinerary, CAC.Settings, CAC.Utils);
