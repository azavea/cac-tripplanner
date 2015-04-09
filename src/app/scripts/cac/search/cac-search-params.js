/**
 * Holds shared search parameters used by suggest and geocoder services.
 */
CAC.Search.SearchParams = (function () {
    'use strict';

    var searchBounds = [
        '-75.243620',
        '39.898295',
        '-75.126531',
        '39.967842'
    ].join(',');

    // search categories from here:
    // https://developers.arcgis.com/rest/geocode/api-reference/geocoding-category-filtering.htm
    var searchCategories = ['Address',
                            'Postal',
                            'Coordinate System',
                            'Populated Place',
                            'POI'
                            ].join(',');

    var module = {
        searchBounds: searchBounds,
        searchCategories: searchCategories
    };

    return Object.freeze(module);

})();
