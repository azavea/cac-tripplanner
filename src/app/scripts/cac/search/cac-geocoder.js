CAC.Search.Geocoder = (function ($, SearchParams) {
    'use strict';

    var url = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find';
    var reverseUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';

    var defaults = {
        bbox: SearchParams.searchBounds,
        category: SearchParams.searchCategories,
        outFields: 'StAddr,City,Region,Postal',
        f: 'pjson',
        maxLocations: 1
    };

    var module = {
        reverse: reverse,
        search: search
    };

    return module;

    // Note: this function is also used in the Django admin interface.
    // If the interface changes, make sure to update accordingly.
    function search(text, magicKey) {
        var dfd = $.Deferred();
        var params = $.extend({}, defaults, {
            text: text,
            magicKey: magicKey || null
        });
        if (magicKey && params.bbox) {
            // The find endpoint apparently dislikes returning previously found results with
            //  suggest when bbox is supplied for a given text & magickey
            delete params.bbox;
        }
        $.ajax(url, {
            data: params,
            dataType: 'json',
            cache: true,
            success: function (data) {
                if (data && data.locations && data.locations.length &&
                    data.locations[0].feature.attributes.StAddr.length) {
                        // results with a street address are probably good
                        dfd.resolve(data.locations[0]);
                    } else {
                        // Deal with geocoder not being able to handle all POI results from
                        // suggest service when POI name comes before street address.
                        var splitText = text.split(', ');
                        if (splitText.length > 1) {
                            var maybeStAddr = splitText[1].split(' ')[0];
                            if (!isNaN(maybeStAddr)) {
                                // probably have POI with street address after name
                                var newText = '';
                                for (var i = 1; i < splitText.length; i++) {
                                    newText += splitText[i] + ', ';
                                }
                                // try searching again without the POI name part
                                params.text = newText;
                                $.ajax(url, {
                                    data: params,
                                    dataType: 'json',
                                    cache: true,
                                    success: function (data) {
                                        if (data && data.locations && data.locations.length &&
                                            data.locations[0].feature.attributes.StAddr.length) {
                                            // second search got something with a street address;
                                            // it is probably good now
                                            dfd.resolve(data.locations[0]);
                                        } else {
                                            // no good geocode result found on second search
                                            dfd.resolve(null);
                                        }
                                    }, error: function (error) {
                                        dfd.reject(error);
                                    }
                                });
                            } else if (data && data.locations && data.locations.length) {
                                // might have result for searching on something that has no
                                // street address, such as a city name or zip code
                                dfd.resolve(data.locations[0]);
                            } else {
                                // no result found
                                dfd.resolve(null);
                            }
                        }
                    }
            },
            error: function (error) {
                dfd.reject(error);
            }
        });

        return dfd.promise();
    }

    /**
     * Reverse geocode given coordinates.  Docs here:
     * http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#//02r30000000n000000
     *
     * @param {Double} lat Latitude to reverse geocode
     * @param {Double} lon Longitude to reverse geocode
     * @returns {Object} Promise that resovles to JSON response with `address` and `location`
     */
    function reverse(lat, lng) {
        var dfd = $.Deferred();

        var params = {
            location: [lng, lat].join(','),
            distance: 900,  // radius, in meters, to search within; defaults to 100m
            returnIntersection: true,
            f: 'pjson',
            cache: true
        };

        $.ajax(reverseUrl, {
            data: params,
            success: function (data) {
                dfd.resolve(JSON.parse(data));
            },
            error: function (error) {
                console.error(error);
                dfd.reject(error);
            }
        });

        return dfd.promise();
    }

})(jQuery, CAC.Search.SearchParams);
