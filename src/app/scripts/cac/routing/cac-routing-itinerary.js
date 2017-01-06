CAC.Routing.Itinerary = (function ($, cartodb, L, _, moment, Geocoder, Utils) {
    'use strict';

    /**
     * Class represents an itinerary between two points
     *
     * @param {object} otpItinerary OTP itinerary
     * @param {integer} index integer to uniquely identify itinerary
     */
    function Itinerary(otpItinerary, index) {
        // extract reverse-geocoded start and end addresses
        var params = Utils.getUrlParams();
        this.fromText = params.originText;
        this.toText = params.destinationText;

        // array of turf points, for ease of use both making into a
        // Leaflet layer as GeoJSON, and for interpolating new waypoints.
        this.waypoints = getWaypointFeatures(params.waypoints);

        this.id = index.toString();
        this.via = getVia(otpItinerary.legs);
        this.modes = getModes(otpItinerary.legs);
        this.formattedDistance = getFormattedItineraryDistance(otpItinerary.legs);
        this.formattedDuration = getFormattedDuration(otpItinerary);
        this.startTime = otpItinerary.startTime;
        this.endTime = otpItinerary.endTime;
        this.legs = getLegs(otpItinerary.legs, (this.waypoints && this.waypoints.length > 0));
        this.from = _.head(otpItinerary.legs).from;
        this.to = _.last(otpItinerary.legs).to;
        this.agencies = getTransitAgencies(otpItinerary.legs);

        // not actually GeoJSON, but a Leaflet layer made from GeoJSON
        this.geojson = cartodb.L.geoJson({type: 'FeatureCollection',
                                          features: this.getFeatures(otpItinerary.legs)});

        // expose method to change linestring styling
        this.setLineColors = setLineColors;

        // default to visible, backgrounded linestring styling
        this.setLineColors(true, false);

        // set by CAC.Routing.Plans with the arguments sent to planTrip:
        // coordsFrom, coordsTo, when, extraOptions
        // (not used by directions list page)
        this.routingParams = null;
    }

    Itinerary.prototype.highlight = function(isHighlighted) {
        this.setLineColors(true, isHighlighted);
    };

    Itinerary.prototype.show = function(isShown) {
        this.setLineColors(isShown, false);
    };

    /**
     * Get geoJSON for an itinerary
     *
     * @param {array} legs set of legs for an OTP itinerary
     * @return {array} array of geojson features
     */
    Itinerary.prototype.getFeatures = function(legs) {
        return _.map(legs, function(leg) {
            var linestringGeoJson = L.Polyline.fromEncoded(leg.legGeometry.points).toGeoJSON();
            linestringGeoJson.properties = leg;
            return linestringGeoJson;
        });
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
     * Helper function to get list of modes used by an itinerary
     *
     * @param {array} legs Legs property of OTP itinerary
     * @return {array} array of strings representing modes for itinerary
     */
    function getModes(legs) {
        return _.chain(legs).map('mode').uniq().value();
    }

    /**
     * Helper function to get total distance in feet or miles for an itinerary
     *
     * @param {array} legs Legs property of OTP itinerary
     * @return {string} distance of itinerary in miles (rounded to 2nd decimal), or,
     *                 if less than .2 mile, in feet (rounded to nearest foot); includes unit.
     */
    function getFormattedItineraryDistance(legs) {
        var distanceMeters = _.chain(legs).map('distance').reduce(function(sum, n) {
            return sum + n;
        });
        return getFormattedDistance(distanceMeters);
    }

    /**
     * Helper function to get formatted string in feet or miles for a given distance in meters
     *
     * @param {double} distanceMeters Distance to format
     * @return {string} distance in miles or feet, rounded, with unit
     */
    function getFormattedDistance(distanceMeters) {
        // less than ~0.2 miles
        if (distanceMeters < 322) {
            return Math.round(distanceMeters * 3.28084).toString() + ' ft';
        }

        // return miles
        return (Math.round(((distanceMeters / 1000) * 0.621371) * 100) / 100).toString() + ' mi';
    }

    /**
     * Helper function to get formatted duration string for an itinerary or leg
     *
     * @param {object} otpItinerary OTP itinerary or leg (both have duration property)
     * @return {string} duration of itinerary/leg, formatted with units (hrs, min, s)
     */
    function getFormattedDuration(otpItineraryLeg) {
        return moment.duration(otpItineraryLeg.duration, 'seconds').humanize();
    }

    /**
     * Helper to parse semicolon-delimited list of waypoints into
     * array of GeoJSON point features.
     *
     * @param {string} waypoints from URL
     * @return {array} GeoJSON features
     */
    function getWaypointFeatures(waypoints) {
        if (!waypoints) {
            return null;
        }

        // explicitly set the index property so it will populate on the geoJSON properties
        // when point array used to create FeatureCollection
        return _.map(waypoints.split(';'), function(point, index) {
            return turf.point(point.split(',').reverse(), {index: index});
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
     * Does some post-processing for the legs, for cleanup and template convenience
     *
     * @params {Array} legs Itinerary legs returned by OTP
     * @param {Boolean} hasWaypoints If true, call mergeLegsAcrossWaypoints
     * @returns {Array} Itinerary legs, with prettified place labels and other improvements
     */
    function getLegs(legs, hasWaypoints) {
        // Check leg from/to place name; if it's an OSM node label, reverse geocode it
        // and update label

        var newLegs = _.map(legs, function(leg) {
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
            return leg;
        });

        // If there are waypoints, call the function to merge legs across them.
        if (hasWaypoints) {
            newLegs = mergeLegsAcrossWaypoints(newLegs);
        }

        // Add some derived data to be used in the template:
        // - Format duration on leg and distance on leg and its steps
        _.forEach(newLegs, function (leg) {
            leg.formattedDistance = getFormattedDistance(leg.distance);
            leg.formattedDuration = getFormattedDuration(leg);
            _.forEach(leg.steps, function(step) {
                step.formattedDistance = getFormattedDistance(step.distance);
            });
        });
        // - Set a flag on the last leg, so we can avoid diplaying arriving there right above
        //   also arriving at the final destination
        newLegs[newLegs.length - 1].lastLeg = true;
        // - And set a flag on legs that end at bike share stations (whether on a bike or walking
        //   to a station), so we can show the icon
        _.forEach(newLegs, function (leg) {
            leg.toBikeShareStation = leg.to.vertexType === 'BIKESHARE';
        });

        return newLegs;
    }

    /* Waypoints always result in a step break, which ends up producing intermediate
     * "to Destination" steps that we don't want to show in the itinerary details.
     * See https://github.com/opentripplanner/OpenTripPlanner/blob/otp-1.0.0/src/main/java/org/opentripplanner/routing/impl/GraphPathFinder.java#L305
     * and https://github.com/opentripplanner/OpenTripPlanner/blob/otp-1.0.0/src/main/java/org/opentripplanner/api/resource/GraphPathToTripPlanConverter.java#L212
     * There's no configuration option to make OTP not do that, so instead this munges the
     * resulting separate steps into one.
     * Specifically, it loops over the legs, checking for each one whether the next one is the same
     * mode and, if so, summing times/distances and resetting the 'to' to turn the first leg into
     * a combination of itself and the second.  Since there can be multiple waypoints in what would
     * be a single leg, more than two consecutive legs can end up getting merged together.
     *
     * Note that this makes no attempt to merge the `legGeometry` attributes so it's important that
     * `getFeatures`, which gets the itinerary's geometry into Leaflet, gets called on the original
     * legs array rather than the munged one.
     */
    function mergeLegsAcrossWaypoints(legs) {
        if (legs.length === 1) {
            return legs;
        }
        var index = 0;
        while(index < legs.length - 1) {
            var thisLeg = legs[index];
            var nextLeg = legs[index+1];
            if (thisLeg.mode === nextLeg.mode && !nextLeg.interlineWithPreviousLeg) {
                var newLeg = _.clone(thisLeg);
                newLeg.distance = thisLeg.distance + nextLeg.distance;
                newLeg.duration = thisLeg.duration + nextLeg.duration;
                newLeg.endTime = nextLeg.endTime;
                newLeg.to = nextLeg.to;

                // If the waypoint is in the middle of what would otherwise be a single step,
                // merge it back into a single step
                var lastStep = _.clone(_.last(thisLeg.steps));
                var nextStep = _.first(nextLeg.steps);
                if (nextStep.relativeDirection === 'CONTINUE' &&
                        lastStep.streetName === nextStep.streetName) {
                    lastStep.distance += nextStep.distance;
                    lastStep.elevation = lastStep.elevation.concat(nextStep.elevation);
                    newLeg.steps = _.concat(_.dropRight(thisLeg.steps, 1),
                                            [lastStep],
                                            _.tail(nextLeg.steps));
                } else {
                    newLeg.steps = _.concat(thisLeg.steps, nextLeg.steps);
                }
                legs.splice(index, 2, newLeg);
            } else {
                index++;
            }
        }
        return legs;
    }

    /**
     * Helper function to set style for an itinerary
     *
     * @param {Boolean} shown Should this itinerary be shown (if false, make transparent)
     * @param {Boolean} highlighted Should this itinerary be highlighted on the map
     */
    function setLineColors(shown, highlighted) {

        if (!shown) {
            this.geojson.setStyle({opacity: 0});
            return;
        }

        var defaultStyle = {clickable: true, // to get mouse events (listen to hover)
                        color: Utils.defaultModeColor,
                        dashArray: null,
                        lineCap: 'round',
                        lineJoin: 'round',
                        opacity: 0.75};

        if (highlighted) {
            defaultStyle.dashArray = null;
            defaultStyle.opacity = 1;
            this.geojson.setStyle(defaultStyle);

            // set color for each leg based on mode
            this.geojson.eachLayer(function(layer) {
                var modeColor = Utils.getModeColor(layer.feature.properties.mode);
                layer.setStyle({color: modeColor});
            });
        } else {
            // in background
            defaultStyle.color = Utils.defaultBackgroundLineColor;
            defaultStyle.dashArray = [5, 8];
            this.geojson.setStyle(defaultStyle);
        }
    }

})(jQuery, cartodb, L, _, moment, CAC.Search.Geocoder, CAC.Utils);
