CAC.Routing.Plans = (function($, moment, _, UserPreferences, Itinerary, Settings) {
    'use strict';

    var module = {
        planTrip: planTrip
    };

    return module;

    /**
     * Find shortest path from one point to another
     *
     * @param {array} coordsFrom The coords in lat-lng which we would like to travel from
     * @param {array} coordsTo The coords in lat-lng which we would like to travel to
     * @param {Object} moment.js date/time object for when the trip should be
     * @param {String} Modes of travel to use for this trip
     *
     * @return {promise} The promise object which - if successful - resolves to a
     *                   an object with itineraries
     */
    function planTrip(coordsFrom, coordsTo, when, extraOptions) {
        var deferred = $.Deferred();
        var urlParams = prepareParams(coordsFrom, coordsTo, when, extraOptions);

        $.ajax({
            url: Settings.routingUrl,
            type: 'GET',
            crossDomain: true,
            data: urlParams,
            processData: false
        }).then(function(data) {
            if (data.plan) {
                // Ensure unique itineraries.
                // Due to issue: https://github.com/opentripplanner/OpenTripPlanner/issues/1894
                // itineraries with transit + (bike/walk) can return 3 identical itineraries if only
                // bike/walk used, and not transit.
                // TODO: remove this workaround once OTP issue resolved.
                var lastItinerary = null;
                var planItineraries = _.reject(data.plan.itineraries, function(itinerary) {
                    var thisItinerary = JSON.stringify(itinerary);
                    if (lastItinerary === thisItinerary) {
                        // found a duplicate itinerary; reject it
                        lastItinerary = thisItinerary;
                        return true;
                    }
                    lastItinerary = thisItinerary;
                    return false;
                });

                // return the Itinerary objects for the unique collection
                var itineraries = _(planItineraries).map(function(itinerary, i) {
                    return new Itinerary(itinerary, i, data.requestParameters);
                }).value();
                deferred.resolve(itineraries);
            } else {
                deferred.reject(data.error);
            }
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise();
    }

    /**
     * Helper function to prepare the parameter string for consumption by the OTP API
     *
     * @param {Array} coordsFrom The coords in lat-lng which we would like to travel from
     * @param {Array} coordsTo The coords in lat-lng which we would like to travel to
     * @param {Object} when Moment.js object for date/time of travel
     * @param {Object} extraOptions Other parameters to pass to OpenTripPlanner as-is
     *
     * @return {string} URL-encoded GET parameters
     */
    function prepareParams(coordsFrom, coordsTo, when, extraOptions) {

        // exclude pre-formatted intermediatePlaces
        var intermediatePlaces = '';
        if (extraOptions.hasOwnProperty('intermediatePlaces')) {
            intermediatePlaces = extraOptions.intermediatePlaces;
            delete extraOptions.intermediatePlaces;
        }

        var formattedOpts = {
            fromPlace: coordsFrom.join(','),
            fromText: extraOptions.fromText,
            toPlace: coordsTo.join(','),
            toText: extraOptions.toText,
            time: when.format('hh:mma'),
            date: when.format('MM-DD-YYYY'),
        };

        return $.param($.extend(formattedOpts, extraOptions)) + '&' + intermediatePlaces;
    }

})(jQuery, moment, _, CAC.User.Preferences, CAC.Routing.Itinerary, CAC.Settings);
