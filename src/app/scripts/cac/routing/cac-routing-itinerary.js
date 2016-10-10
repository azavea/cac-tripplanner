CAC.Routing.Itinerary = (function ($, cartodb, L, _, moment, Geocoder, Utils) {
    'use strict';

    /**
     * Class represents an itinerary between two points
     *
     * @param {object} otpItinerary OTP itinerary
     * @param {integer} index integer to uniquely identify itinerary
     */
    function Itinerary(otpItinerary, index) {
        this.id = index.toString();
        this.via = getVia(otpItinerary.legs);
        this.modes = getModes(otpItinerary.legs);
        this.distanceMiles = getDistanceMiles(otpItinerary.legs);
        this.formattedDuration = getFormattedDuration(otpItinerary);
        this.startTime = otpItinerary.startTime;
        this.endTime = otpItinerary.endTime;
        this.legs = getLegs(otpItinerary.legs);
        this.from = _.head(otpItinerary.legs).from;
        this.to = _.last(otpItinerary.legs).to;
        this.agencies = getTransitAgencies(otpItinerary.legs);

        this.geojson = cartodb.L.geoJson({type: 'FeatureCollection',
                                          features: getFeatures(otpItinerary.legs)});
        this.geojson.setStyle(getStyle(true, false));

        // extract reverse-geocoded start and end addresses
        var params = Utils.getUrlParams();
        this.fromText = params.originText;
        this.toText = params.destinationText;

        // expose functions
        this.getStyle = getStyle;
    }

    Itinerary.prototype.highlight = function (isHighlighted) {
        this.geojson.setStyle(getStyle(true, isHighlighted));
    };

    Itinerary.prototype.show = function (isShown) {
        this.geojson.setStyle(getStyle(isShown, false));
    };

    // cache of geocoded OSM nodes (node name mapped to reverse geocode name)
    var nodeCache = {};

    return Itinerary;

    /**
     * Find transit agency names for this itinerary.
     *
     * @param {array} legs Legs property of OTP itinerary
     * @return {array} List of unique agency names traversed in this itinerary
     */
    function getTransitAgencies(legs) {
        return _.chain(legs).map('agencyName').uniq().without(undefined).value();
    }

    /**
     * Helper function to get label/via summary for an itinerary.
     * Chooses the streetname with the longest distance for an
     * itinerary.
     *
     * @param {array} legs Legs property of OTP itinerary
     * @return {string} string to use for labeling an itinerary
     */
    function getVia(legs) {
        return _.chain(legs).map('steps').flatten().max(function(step) {
            return step.distance;
        }).value().streetName;
    }

    /**
     * Helper function to get label/via summary for an itinerary
     *
     * @param {array} legs Legs property of OTP itinerary
     * @return {array} array of strings representing modes for itinerary
     */
    function getModes(legs) {
        return _.chain(legs).map('mode').uniq().value();
    }

    /**
     * Helper function to get label/via summary for an itinerary
     *
     * @param {array} legs Legs property of OTP itinerary
     * @return {float} distance of itinerary in miles (rounded to 2nd decimal)
     */
    function getDistanceMiles(legs) {
        var distanceMeters = _.chain(legs).map('distance').reduce(function(sum, n) {
            return sum + n;
        });
        return Math.round(((distanceMeters / 1000) * 0.621371) * 100) / 100;
    }

    /**
     * Helper function to get label/via summary for an itinerary or leg
     *
     * @param {object} otpItinerary OTP itinerary or leg (both have duration property)
     * @return {string} duration of itinerary/leg, formatted with units (hrs, min, s)
     */
    function getFormattedDuration(otpItineraryLeg) {
        // x hrs, y min, z s (will trim empty units from left)
        var fmt = 'h [hrs], m [min], ss [s]';
        var str = moment.duration(otpItineraryLeg.duration, 'seconds').format(fmt);
        // trim empty seconds from right of string
        var emptySecIdx = str.indexOf(', 00 s');
        if (emptySecIdx > 0) {
            str = str.substring(0, emptySecIdx);
        }
        // fix hour singular
        str = str.replace('1 hrs,', '1 hr,');
        return str;
    }

    /**
     * Helper function to get label/via summary for an itinerary
     *
     * @param {array} legs set of legs for an OTP itinerary
     * @return {array} array of geojson features
     */
    function getFeatures(legs) {
        return _.map(legs, function(leg) {
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
            if (leg.from.name.indexOf('Start point 0.') > -1) {
                getOsmNodeName(leg.from).then(function(name) {
                    leg.from.name = name;
                });
            }
            if (leg.to.name.indexOf('Start point 0.') > -1) {
                getOsmNodeName(leg.to).then(function(name) {
                    leg.to.name = name;
                });
            }
            leg.formattedDuration = getFormattedDuration(leg);
            return leg;
        });
    }

    /**
     * Helper function to construct style object for an itinerary
     *
     * @param {Boolean} shown Should this itinerary be shown (if false, make transparent)
     * @param {Boolean} highlighted Should this itinerary be highlighted on the map
     * @return {Object} Leaflet style object to apply to geojson
     */
    function getStyle(shown, highlighted) {
        if (!shown) {
            return {opacity: 0};
        }
        var defaultStyle = {clickable: true, // to get mouse events (listen to hover)
                            color: '#d02d2d',
                            dashArray: null,
                            lineCap: 'round',
                            lineJoin: 'round',
                            opacity: 0.75};
        if (highlighted) {
            defaultStyle.dashArray = null;
        } else {
            defaultStyle.color = '#2c7fb8';
            defaultStyle.dashArray = [5, 8];
        }
        return defaultStyle;
    }

})(jQuery, cartodb, L, _, moment, CAC.Search.Geocoder, CAC.Utils);
