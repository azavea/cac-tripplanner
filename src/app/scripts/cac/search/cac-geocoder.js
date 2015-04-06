CAC.Search.Geocoder = (function ($) {
    'use strict';

    var url = 'http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find';
    var reverseUrl = 'http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';

    var defaults = {
        bbox: [
            '-75.243620',
            '39.898295',
            '-75.126531',
            '39.967842'
        ].join(','),
        category: 'Address,POI',
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

    function reverse(lat, lng) {
        var dfd = $.Deferred();

        var params = {
            location: [lng, lat].join(','),
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

})(jQuery);
