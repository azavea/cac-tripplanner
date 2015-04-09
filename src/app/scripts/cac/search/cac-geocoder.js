CAC.Search.Geocoder = (function ($, SearchParams) {
    'use strict';

    var url = 'http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find';
    var reverseUrl = 'http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';

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
            success: function (data) {
                if (data && data.locations && data.locations.length) {
                    dfd.resolve(data.locations[0]);
                } else {
                    // no geocode result found; return null
                    dfd.resolve(null);
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
            f: 'pjson'
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
