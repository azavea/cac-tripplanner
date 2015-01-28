CAC.Routing.Plans = (function($, L, moment, _, UserModes, Itinerary) {
    'use strict';

    var planMode = ['WALK', 'TRANSIT'];
    var routingUrl = '/otp/routers/default/plan';

    var module = {
        planTrip: planTrip,
        getItineraryById: getItineraryById,
        itineraries: {},
        setItineraryStyles: setItineraryStyles,
        removeItineraryLayers: removeItineraryLayers
    };

    return module;

    /**
     * Find shortest path from one point to another
     *
     * @param {array} coordsFrom The coords in lat-lng which we would like to travel from
     * @param {array} coordsTo The coords in lat-lng which we would like to travel to
     *
     * @return {promise} The promise object which - if successful - resolves to a
     *                   an object with itineraries
     */
    function planTrip(coordsFrom, coordsTo, map) {
        var deferred = $.Deferred();
        var urlParams = prepareParamString(coordsFrom, coordsTo);
        var requestUrl = routingUrl + '?' + urlParams;
        return $.ajax({
            url: requestUrl,
            type: 'GET',
            contentType: 'application/json'
        }).then(function(data) {
            removeItineraryLayers(map);
            module.itineraries = _(data.plan.itineraries).map(createItinerary).indexBy('id').value();
            deferred.resolve(module.itineraries);
        });
        return deferred.promise();
    }

    /**
     * Helper function to prepare the parameter string for consumption by the OTP api
     *
     * @param {array} coordsFrom The coords in lat-lng which we would like to travel from
     * @param {array} coordsTo The coords in lat-lng which we would like to travel to
     *
     * @return {string} A set of get params, ready for consumption
     */
    function prepareParamString(coordsFrom, coordsTo) {
        var currentTime = moment();
        var formattedTime = currentTime.format('hh:mma');
        var formattedDate = currentTime.format('MM-DD-YYYY');
        var paramObj = {
            fromPlace: coordsFrom,
            toPlace: coordsTo,
            time: formattedTime,
            date: formattedDate,
            mode: UserModes.makeModeString()
        };
        return $.param(paramObj);
    }

    /**
     * Helper function to remove itineraries from map, called before adding new itineraries
     *
     * @param {object} map leaflet map object
     */
    function removeItineraryLayers(map) {
        _.forIn(module.itineraries, function(itinerary) {
            map.removeLayer(itinerary.geojson);
        });
    };


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

    /**
     * Helper function to return an itinerary object
     *
     * @param {integer} ID for itinerary to return
     */
    function getItineraryById(id) {
        return module.itineraries[id];
    }

    /**
     * Helper function to set itinerary styles
     *
     * @param {integer} id Itinerary ID to highlight
     */
    function setItineraryStyles(id) {
        _.forIn(module.itineraries, function(itinerary) {
            var style = itinerary.getStyle(id);
            itinerary.geojson.setStyle(style);
        });
    }

})(jQuery, L, moment, _, CAC.User.Modes, CAC.Routing.Itinerary);
