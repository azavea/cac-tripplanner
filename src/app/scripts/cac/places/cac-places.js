CAC.Places.Places = (function(_, $, moment, Routing, UserPreferences, Utils) {
    'use strict';

    var module = {
        getAllPlaces: getAllPlaces,
        getOtpOptions: getOtpOptions,
        getTimesToPlaces: getTimesToPlaces
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
            var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
            bikeTriangle = Utils.getBikeTriangle(bikeTriangle);
            if (bikeTriangle) {
                $.extend(otpOptions, {optimize: 'TRIANGLE'}, bikeTriangle);
            }
        } else {
            $.extend(otpOptions, { wheelchair: UserPreferences.getPreference('wheelchair') });
        }

        return otpOptions;
    }

    /** Get travel times from the orign to each destination.
     *  Should be called before displaying place list.
     *
     * @param destinations {Array} Destination and event objects that will be changed in-place
     * @param exploreLatLng {Array} Coordinates of origin point to query with; may be unset
     * @returns {Array} Collection of promises, each of which resolve to a destination
     */
    function getTimesToPlaces(destinations, exploreLatLng) {
        // if origin not set, simply clear the travel times from the destinations
        if (!exploreLatLng) {
            _.each(destinations, function(destination) {
                destination.duration = undefined;
                destination.formattedDuration = undefined;
                destination.originLabel = undefined;
            });
            return;
        }

        // make ajax requests to get the travel times to each destination
        var otpOptions = getOtpOptions();
        // only using the first itinerary; let OTP know to not bother finding other options
        $.extend(otpOptions, {numItineraries: 1});

        var date = UserPreferences.getPreference('dateTime');
        date = date ? moment.unix(date) : moment(); // default to now

        // prefer to label with just the street address, and fall back to full address
        // for featured places, use the label in the 'name' attribute instead of the address
        var origin = UserPreferences.getPreference('origin');
        var originLabel = origin.name ? origin.name :
            (origin.attributes && origin.attributes.StAddr ? origin.attributes.StAddr :
            UserPreferences.getPreference('originText'));

        var promises = _.map(destinations, function(destination) {
            var dfd = $.Deferred();
            // if already have travel time to destination, skip requerying for it
            if (destination.originLabel === originLabel) {
                dfd.resolve(destination);
                return dfd.promise();
            }

            // read out the location of the destination
            var xCoord = destination.location.x;
            var yCoord = destination.location.y;

            if (xCoord && yCoord) {
                var placeCoords = [yCoord, xCoord];
                // get travel time to destination and update place card
                Routing.planTrip(exploreLatLng, placeCoords, date, otpOptions)
                .then(function (itineraries) {
                    if (itineraries && itineraries.length) {
                        var itinerary = itineraries[0];
                        // set properties for travel time to place and the origin label
                        destination.duration = itinerary.duration;
                        destination.formattedDuration = itinerary.formattedDuration;
                        destination.originLabel = originLabel;
                        dfd.resolve(destination);
                    }
                }).fail(function(error) {
                    console.error('error finding travel time to ' + destination.name);
                    console.error(error);
                    dfd.reject(error);
                });
            } else {
                // event without a location
                dfd.resolve(destination);
            }
            return dfd.promise();
        });

        return promises;
    }

})(_, jQuery, moment, CAC.Routing.Plans, CAC.User.Preferences, CAC.Utils);
