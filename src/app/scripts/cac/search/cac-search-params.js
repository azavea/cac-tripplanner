/**
 * Holds shared search parameters used by suggest and geocoder services.
 */
CAC.Search.SearchParams = (function () {
    'use strict';

    // bounds to cover are the counties of the DVRPC region, as shown here:
    // http://pecpa.org/wp-content/uploads/Recreation-The-Circuit-map-photo-Patrick-1260x979.jpg
    // and also extended to cover the state of Delaware fully
    var searchExtent = [
        '-76.209582',
        '38.441753',
        '-74.243725',
        '40.725449'
    ].join(',');

    // search categories from here:
    // https://developers.arcgis.com/rest/geocode/api-reference/geocoding-category-filtering.htm
    var searchCategories = ['Address',
                            'Postal',
                            'Coordinate System',
                            'Populated Place',
                            'POI'
                            ].join(',');

    var rankDistance = 160934; // preferentially rank results within this many meters (100mi)
    var cityHall = '-75.163572,39.952368'; // default center for results bias
    var mapCenter = null; // update to modify center for results bias

    var module = {
        searchExtent: searchExtent,
        searchCategories: searchCategories,
        distance: rankDistance,
        getLocation: getLocation,
        updateMapCenter: updateMapCenter
    };

    function getLocation() {
        return mapCenter || cityHall;
    }

    // set location to map center for geocoder results bias on map move
    function updateMapCenter(event, coords) {
        mapCenter = [coords.lng, coords.lat].join(',');
    }

    return Object.freeze(module);

})();
