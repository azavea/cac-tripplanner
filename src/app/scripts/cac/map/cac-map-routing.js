CAC.Map.Routing = (function($, moment, UserPreferences) {
    'use strict'

    var planMode = ['WALK', 'TRANSIT'];
    var routingUrl = '/otp/routers/default/plan';
    var module = {
        planTrip: planTrip
    };
    return module;

    /**
     * Find shortest path from one point to another
     *
     * @param coordsFrom {array} The coords in lat-lng which we would like to travel from
     * @param coordsTo {array} The coords in lat-lng which we would like to travel to
     *
     * @return {object} (promise) The promise object which - if successful - resolves in a
     *                              geoJSON representation of a trip
     */
    function planTrip(coordsFrom, coordsTo) {
        var deferred = $.Deferred();
        var urlParams = prepareParamString(coordsFrom, coordsTo);
        var requestUrl = routingUrl + '?' + urlParams;
        $.ajax({
            url: requestUrl,
            type: 'GET',
            contentType: 'application/json'
        }).then(deferred.resolve);
        return deferred.promise();
    }


    /**
     * Helper function to prepare the parameter string for consumption by the OTP api
     *
     * @param coordsFrom {array} The coords in lat-lng which we would like to travel from
     * @param coordsTo {array} The coords in lat-lng which we would like to travel to
     *
     * @return {string} A set of get params, ready for consumption
     */
    function prepareParamString(coordsFrom, coordsTo) {
        var currentTime = moment();
        var formattedTime = currentTime.format('hh:mma');
        var formattedDate = currentTime.format('MM-DD-YYYY');
        var paramObj = {
            fromPlace: coordsFrom[0] + ',' + coordsFrom[1],
            toPlace: coordsTo[0] + ',' + coordsTo[1],
            time: formattedTime,
            date: formattedDate,
            mode: UserPreferences.makeModeString()
        };
        return $.param(paramObj);
    }


})(jQuery, moment, CAC.User.Preferences);
