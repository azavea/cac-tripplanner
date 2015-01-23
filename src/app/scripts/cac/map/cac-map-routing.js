CAC.Map.Routing = (function() {
    'use strict'

    var planningOpts = {};
    var routingUrl = '192.168.8.26:8080/otp/routers/default/plan';
    var module = {

    };

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
        var requestParams = R.mixin(planningOpts, {'fromPlace': coordsFrom[0] + ',' + coordsFrom[1],
                                            'toPlace': coordsTo[0] + ',' + coordsFrom[1]});
        if (requestParams.fromPlace && requestParams.toPlace &&
            requestParams.date && requestParams.time) {
            var urlParams = $.param(requestParams);
            var requestUrl = routingUrl + urlParams;
            $.ajax({
                type: 'GET',
                url: requestUrl,
                contentType: 'application/json'
            }).then(deferred.resolve);
        } else {
            deferred.fail();
        }
        return deferred.promise();
    }

'''
?fromPlace=39.93606595478707%2C-75.18570899963379
&toPlace=39.9101312551376%2C-75.16914367675781
&time=5%3A02pm
&date=01-22-2015
&mode=TRANSIT%2CWALK
&maxWalkDistance=750
&arriveBy=false
&showIntermediateStops=false
'''







})();
