CAC.Search.Geocoder = (function ($, SearchParams) {
    'use strict';

    var url = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
    var reverseUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';

    var defaults = {
        searchExtent: SearchParams.searchExtent,
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

    function getParams(text, magicKey) {
        var params = $.extend({}, defaults, {
            magicKey: magicKey || null,
            singleLine: text,
            location: SearchParams.getLocation(),
            distance: SearchParams.distance
        });

        if (magicKey && params.searchExtent) {
            // The find endpoint apparently dislikes returning previously found results with
            //  suggest when bounds supplied for a given text & magickey
            delete params.searchExtent;
        }

        return params;
    }

    // Note: this function is also used in the Django admin interface.
    // If the interface changes, make sure to update accordingly.
    function search(text, magicKey) {
        var dfd = $.Deferred();
        $.ajax(url, {
            data: getParams(text, magicKey),
            dataType: 'json',
            cache: true,
            success: function (data) {
                if (data && data.candidates && data.candidates.length &&
                        data.candidates[0].attributes.StAddr.length) {
                    // results with a street address are probably good
                    dfd.resolve(data.candidates[0]);
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
                            $.ajax(url, {
                                data: getParams(newText, magicKey),
                                dataType: 'json',
                                cache: true,
                                success: function (data) {
                                    returnLocation(data, dfd);
                                }, error: function (error) {
                                    console.error(error);
                                    dfd.reject(error);
                                }
                            });
                        } else {
                            returnLocation(data, dfd);
                        }
                    } else {
                        returnLocation(data, dfd);
                    }
                }
            },
            error: function (error) {
                console.error(error);
                dfd.reject(error);
            }
        });

        return dfd.promise();
    }

    // Helper function to encapsulate the "return whatever location we have, if we have one"
    // logic, since it's needed repeatedly
    function returnLocation(data, dfd) {
        if (data && data.candidates && data.candidates.length) {
            dfd.resolve(data.candidates[0]);
        } else {
            dfd.resolve(null);
        }
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
            cache: false  // otherwise might get 304s
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
