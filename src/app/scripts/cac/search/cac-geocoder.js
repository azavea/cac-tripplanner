CAC.Search.Geocoder = (function ($) {
    'use strict';

    var url = 'http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find';

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

})(jQuery);
