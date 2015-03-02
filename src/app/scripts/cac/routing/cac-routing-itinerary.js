CAC.Routing.Itinerary = (function ($, L, _) {
    'use strict';

    /**
     * Class represents an itinerary between two points
     *
     * @param {object} otpItinerary OTP itinerary
     * @param {integer} index integer to uniquely identify itinerary
     */
    function Itinerary(otpItinerary, index) {
        this.id = index.toString();
        this.via = getVia(otpItinerary);
        this.modes = getModes(otpItinerary);
        this.distanceMiles = getDistanceMiles(otpItinerary);
        this.durationMinutes = getDurationMinutes(otpItinerary);

        this.geojson = L.geoJson({type: 'FeatureCollection',
                                  features: getFeatures(otpItinerary.legs)});
        this.geojson.setStyle(getStyle());
    }

    Itinerary.prototype.highlight = function (isHighlighted) {
        this.geojson.setStyle(getStyle(isHighlighted));
    };

    return Itinerary;

    /**
     * Helper function to get label/via summary for an itinerary.
     * Chooses the streetname with the longest distance for an
     * itinerary.
     *
     * @param {object} otpItinerary OTP itinerary
     *
     * @return {string} string to use for labeling an itinerary
     */
    function getVia(otpItinerary) {
        var steps = _(otpItinerary.legs).map(function(leg) {
            return leg.steps;
        }).flatten();

        return steps.max(function(step) {
            return step.distance;
        }).streetName;
    }

    /**
     * Helper function to get label/via summary for an itinerary
     *
     * @param {object} otpItinerary OTP itinerary
     *
     * @return {array} array of strings representing modes for itinerary
     */
    function getModes(otpItinerary) {
        var modes = _(otpItinerary.legs).map(function(leg) {
            return leg.mode;
        });
        return modes.uniq().value();
    }

    /**
     * Helper function to get label/via summary for an itinerary
     *
     * @param {object} otpItinerary OTP itinerary
     *
     * @return {float} distance of itinerary in miles (rounded to 2nd decimal)
     */
    function getDistanceMiles(otpItinerary) {
        var distanceMeters = _(otpItinerary.legs).map(function(leg) {
            return leg.distance;
        }).reduce(function(sum, n){
            return sum + n;
        });
        return Math.round(((distanceMeters / 1000) * 0.621371) * 100) / 100;
    }

    /**
     * Helper function to get label/via summary for an itinerary
     *
     * @param {object} otpItinerary OTP itinerary
     *
     * @return {integer} duration of itinerary in minutes
     */
    function getDurationMinutes(otpItinerary) {
        return parseInt(otpItinerary.duration / 60.0);
    }

    /**
     * Helper function to get label/via summary for an itinerary
     *
     * @param {object} itineraryLegs set of legs for an itinerary
     *
     * @return {array} array of geojson features
     */
    function getFeatures(itineraryLegs) {
        return _.map(itineraryLegs, function(leg) {
            var linestringGeoJson = L.Polyline.fromEncoded(leg.legGeometry.points).toGeoJSON();
            linestringGeoJson.properties = leg;
            return linestringGeoJson;
        });
    }

    /**
     * Helper function to construct style object for an itinerary
     *
     * @param {integer} ID that determines if this itinerary should be
     * highlighted on the map
     *
     * @return {object} Leaflet style object to apply to geojson
     */
    function getStyle(highlighted) {
        var defaultStyle = {color: 'Black',
                            dashArray: null};
        if (highlighted) {
            defaultStyle.dashArray = null;
        } else {
            defaultStyle.dashArray = [5, 15];
        }
        return defaultStyle;
    }

})(jQuery, L, _);
