/**
 * Holds shared search parameters used by suggest and geocoder services.
 */
CAC.Search.SearchParams = (function () {
    'use strict';

    // bounds to cover are the counties here:
    // http://pecpa.org/wp-content/uploads/Recreation-The-Circuit-map-photo-Patrick-1260x979.jpg
    var searchBounds = [
        '-76.209582',
        '39.467695',
        '-74.243725',
        '40.725449'
    ].join(',');

    // search categories from here:
    // https://developers.arcgis.com/rest/geocode/api-reference/geocoding-category-filtering.htm
    var searchCategories = ['Address',
                            'Postal',
                            'Coordinate System',
                            //'Populated Place',
                            //'POI'
                            ].join(',');

    var module = {
        searchBounds: searchBounds,
        searchCategories: searchCategories
    };

    return Object.freeze(module);

})();
