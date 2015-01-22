CAC.Isochrone = (function ($) {
    'use strict';

    var payload = {};
    var isochroneUrl = '/reachable';
    var module = {
        payload: payload,
        fetchReachable: fetchReachable
    };

    return module;

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
            return deferred.fail();
        }
        return deferred.promise();
    }

})(jQuery);
