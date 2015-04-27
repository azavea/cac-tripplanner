CAC.Routing.Itinerary = (function ($, L, _, Geocoder) {
    'use strict';

    /**
     * Class represents an itinerary between two points
     *
     * @param {object} otpItinerary OTP itinerary
     * @param {integer} index integer to uniquely identify itinerary
     * @param {object} parameters used for the OTP request
     */
    function Itinerary(otpItinerary, index, requestParameters) {
        this.id = index.toString();
        this.requestParameters = requestParameters;
        this.via = getVia(otpItinerary);
        this.modes = getModes(otpItinerary);
        this.distanceMiles = getDistanceMiles(otpItinerary);
        this.durationMinutes = getDurationMinutes(otpItinerary);
        this.startTime = otpItinerary.startTime;
        this.endTime = otpItinerary.endTime;
        this.legs = getLegs(otpItinerary.legs);
        this.from = _.first(otpItinerary.legs).from;
        this.to = _.last(otpItinerary.legs).to;

        this.geojson = L.geoJson({type: 'FeatureCollection',
                                  features: getFeatures(otpItinerary.legs)});
        this.geojson.setStyle(getStyle());
    }

    Itinerary.prototype.highlight = function (isHighlighted) {
        this.geojson.setStyle(getStyle(isHighlighted));
    };

    /**
     * Get Itinerary bounds, based on the origin/dest lat/lngs
     * @param  {[number]} bufferRatio optionally buffer the returned bounds object
     * @return {[L.LatLngBounds]}
     */
    Itinerary.prototype.getBounds = function(bufferRatio) {
        var sw = L.latLng(
            Math.min(this.from.lat, this.to.lat),
            Math.min(this.from.lon, this.to.lon)
        );
        var ne = L.latLng(
            Math.max(this.from.lat, this.to.lat),
            Math.max(this.from.lon, this.to.lon)
        );
        var bounds = L.latLngBounds(sw, ne);
        bufferRatio = bufferRatio || 0;
        return bounds.pad(bufferRatio);
    };

    // cache of geocoded OSM nodes (node name mapped to reverse geocode name)
    var nodeCache = {};

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
     * Helper to reverse geocode OSM node labels. Caches results.
     *
     * @param {Object} place `from` or `to` object from an OTP itinerary leg
     * @returns {Object} Promise that resolves to reverse geocode result for the location
     */
    function getOsmNodeName(place) {
        var dfd = $.Deferred();

        if (_.has(nodeCache, place.name)) {
            dfd.resolve(nodeCache[place.name]);
            return dfd.promise();
        }

        // not cached; go reverse geocode it
        Geocoder.reverse(place.lat, place.lon).then(function(result) {
            nodeCache[place.name] = result.address.Address;
            dfd.resolve(result.address.Address);
        });

        return dfd.promise();
    }

    /**
     * Check leg from/to place name; if it's an OSM node label, reverse geocode it and update label
     *
     * @params {Array} legs Itinerary legs returned by OTP
     * @returns {Array} Itinerary legs, with prettified place labels
     */
    function getLegs(legs) {
        return _.map(legs, function(leg) {
            if (leg.from.name.indexOf('osm:node') > -1) {
                getOsmNodeName(leg.from).then(function(name) {
                    leg.from.name = name;
                });
            }
            if (leg.to.name.indexOf('osm:node') > -1) {
                getOsmNodeName(leg.to).then(function(name) {
                    leg.to.name = name;
                });
            }
            return leg;
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

})(jQuery, L, _, CAC.Search.Geocoder);
