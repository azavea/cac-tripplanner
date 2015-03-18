CAC.Routing.Plans = (function($, L, moment, _, UserPreferences, Itinerary, Settings) {
    'use strict';

    //var planMode = ['WALK', 'TRANSIT'];

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
    function planTrip(coordsFrom, coordsTo, when, mode, arriveBy) {
        var deferred = $.Deferred();
        var urlParams = prepareParams(coordsFrom, coordsTo, when, mode, arriveBy);
        $.ajax({
            url: Settings.routingUrl,
            type: 'GET',
            contentType: 'application/json',
            dataType: 'jsonp',
            data: urlParams
        }).then(function(data) {
            var itineraries = _(data.plan.itineraries).map(createItinerary).indexBy('id').value();
            deferred.resolve(itineraries);
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise();
    }

    /**
     * Helper function to prepare the parameter string for consumption by the OTP api
     *
     * @param {array} coordsFrom The coords in lat-lng which we would like to travel from
     * @param {array} coordsTo The coords in lat-lng which we would like to travel to
     *
     * @return {string} An object of get params, ready for consumption
     */
    function prepareParams(coordsFrom, coordsTo, when, mode, arriveBy) {
        return {
            fromPlace: coordsFrom.join(','),
            toPlace: coordsTo.join(','),
            time: when.format('hh:mma'),
            date: when.format('MM-DD-YYYY'),
            mode: mode,
            arriveBy: arriveBy
        };
    }

    /**
     * Helper function to create a new Itinerary object
     *
     * @param {object} otpItinerary Itinerary object returned from OTP
     * @param {integer} index Unique ID for itinerary creating
     *
     * @return {Itinerary} Itinerary object
     */
    function createItinerary(otpItinerary, index) {
        return new Itinerary(otpItinerary, index);
    }

})(jQuery, L, moment, _, CAC.User.Preferences, CAC.Routing.Itinerary, CAC.Settings);
