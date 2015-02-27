CAC.Map.Isochrone = (function ($) {
    'use strict';

    var payload = {};
    var isochroneUrl = '/reachable';
    var module = {
        payload: payload,
        fetchReachable: fetchReachable,
        testFetch: testFetch
    };

    return module;

    /**
     * Use test values to attempt a call to the isochrone endpoint
     *
     * @return undefined Use side effects to print data out
     */
    function testFetch() {
        var testParams = {
            coords: {
                lat: 39.954688,
                lng: -75.204677
            },
            mode: ['WALK', 'TRANSIT'],
            date: '01-21-2015',
            time: '7:30am',
            maxTravelTime: 5000,
            maxWalkDistance: 5000
        };
        fetchReachable(testParams).then(function() {
            //console.log(data);
        });
    }

    /**
     * Fetch all the reachable destinations within our destination database
     *
     * @return {object} (promise) which will ultimately be a list of reachable destinations
     */
    function fetchReachable() {
        var deferred = $.Deferred();
        if (payload.coords && payload.mode && payload.date &&
            payload.time && payload.maxTravelTime && payload.maxWalkDistance) {
            var urlParams = $.param(payload);
            var requestUrl = isochroneUrl + urlParams;
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

})(jQuery);
