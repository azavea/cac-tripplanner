CAC.Places.Places = (function(_, $, UserPreferences) {
    'use strict';

    var module = {
        getAllPlaces: getAllPlaces,
        getOtpOptions: getOtpOptions,
        getDistancesToPlaces: getDistancesToPlaces
    };

    return module;

    /**
     * Query Django app for all destinations. If origin set, will order by distance.
     *
     * @param exploreLatLng {Array} Coordinates of origin point to query with; may be unset
     * @return {promise} Promise which resolves to list of destinations
     */
    function getAllPlaces(exploreLatLng) {
        var dfd = $.Deferred();
        var searchUrl = '/api/destinations/search';
        var params = {
            url: searchUrl,
            type: 'GET'
        };

        if (!exploreLatLng) {
            // if origin is not set, re-fetch all by querying with a blank text search
            params.data = {text: ''};
        } else {
            // use origin
            params.data = {
                lat: exploreLatLng[0],
                lon: exploreLatLng[1]
            };
        }

        $.ajax(params).done(function(data) {
            if (!data || !data.destinations) {
                console.error('no places found');
                console.error(data);
                dfd.resolve([]);
            } else {
                dfd.resolve(data);
            }
        }).fail(function(error) {
            console.error('error fetching destinations:');
            console.error(error);
            dfd.reject();
        });
        return dfd.promise();
    }

    /**
     * Get parameters to pass to OpenTripPlanner, based on current settings
     *
     * @returns {Object} extra parameter set to pass to Routing.planTrip
     */
    function getOtpOptions() {
        var mode = UserPreferences.getPreference('mode');

        // options to pass to OTP as-is
        var otpOptions = {
            mode: mode,
            arriveBy: UserPreferences.getPreference('arriveBy'),
            maxWalkDistance: UserPreferences.getPreference('maxWalk')
        };

        if (mode.indexOf('BICYCLE') > -1) {
            // set bike trip optimization option
            var bikeOptimize = UserPreferences.getPreference('bikeOptimize');
            if (bikeOptimize) {
                $.extend(otpOptions, {optimize: bikeOptimize});
            }
        } else {
            $.extend(otpOptions, { wheelchair: UserPreferences.getPreference('wheelchair'),
                                   optimize: 'GREENWAYS' });
        }

        return otpOptions;
    }

    /** Get distance (as the crow flies) from the orign to each destination.
     *  Should be called before displaying place list.
     *
     * @param destinations {Array} Destination and event objects that will be changed in-place
     * @param exploreLatLng {Array} Coordinates of origin point to start from; may be unset
     * @returns {Array} Destinations with distance and orign label set
     */
    function getDistancesToPlaces(destinations, exploreLatLng) {
        // prefer to label with just the street address, and fall back to full address
        // for featured places, use the label in the 'name' attribute instead of the address
        var origin = UserPreferences.getPreference('origin');
        var originLabel;

        if (origin) {
            originLabel = origin.name ? origin.name :
                (origin.attributes && origin.attributes.StAddr ? origin.attributes.StAddr :
                UserPreferences.getPreference('originText'));
        }

        if (exploreLatLng) {
            var from = turf.point([exploreLatLng[1], exploreLatLng[0]]);
        }

        _.each(destinations, function(destination) {
            // if origin not set, simply clear the travel times from the destinations
            if (!from) {
                destination.distance = undefined;
                destination.formattedDistance = undefined;
                destination.originLabel = undefined;
                return;
            }

            // if already have travel time to destination, skip requerying for it
            if (destination.originLabel === originLabel) {
                return;
            }

            // read out the location of the destination
            var xCoord = destination.location.x;
            var yCoord = destination.location.y;

            if (xCoord && yCoord) {
                var to = turf.point([xCoord, yCoord]);
                // get travel distance to destination
                // set properties for travel distnace to place and the origin label
                destination.distance = turf.distance(from, to, {units: 'miles'});
                // format to number with maximum of 2 decimal places
                var miles = (Math.round(destination.distance * 100) / 100).toString();
                destination.formattedDistance = miles === '1' ?
                    miles + ' mile' : miles + ' miles';
                destination.originLabel = originLabel;
            }
        });
        return destinations;
    }

})(_, jQuery, CAC.User.Preferences);
