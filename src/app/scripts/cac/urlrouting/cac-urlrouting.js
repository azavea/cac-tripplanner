/**
 * A basic URL router and related utilities.
 *
 * The app is still based on local storage, but this enables some URL navigation and facilitates
 * the interaction between that and local storage.
 */

CAC.UrlRouting.UrlRouter = (function (_, $, UserPreferences, Utils, Navigo) {

    'use strict';

    // User pref parameters for different views
    var SHARED_PREFS = ['origin', 'originText', 'mode', 'maxWalk', 'wheelchair', 'bikeTriangle'];
    var DIRECTIONS_PREFS = SHARED_PREFS.concat([ 'destination', 'destinationText', 'arriveBy']);
    var EXPLORE_PREFS = SHARED_PREFS.concat(['placeId', 'exploreTime']);

    var router = null;

    function UrlRouter() {
        router = new Navigo('/map');

        router.on(new RegExp('/places/?\?'), setExplorePrefsFromUrl);
        router.on(new RegExp('/directions/?\?'), setDirectionsPrefsFromUrl);

        router.resolve();
    }

    UrlRouter.prototype.updateUrl = updateUrl;
    UrlRouter.prototype.clearUrl = clearUrl;
    UrlRouter.prototype.setExplorePrefsFromUrl = setExplorePrefsFromUrl;
    UrlRouter.prototype.buildExploreUrlFromPrefs = buildExploreUrlFromPrefs;
    UrlRouter.prototype.setDirectionsPrefsFromUrl = setDirectionsPrefsFromUrl;
    UrlRouter.prototype.buildDirectionsUrlFromPrefs = buildDirectionsUrlFromPrefs;

    return UrlRouter;

    // Updates the displayed URL without triggering any routing callbacks
    function updateUrl(url) {
        router.pause(true);
        router.navigate(url);
        router.pause(false);
    }

    function clearUrl() {
        updateUrl('');
    }

    function setExplorePrefsFromUrl() {
        UserPreferences.setPreference('method', 'explore');
        setPrefsFromUrl(EXPLORE_PREFS);
    }

    function buildExploreUrlFromPrefs() {
        return '/places?' + buildUrlParamsFromPrefs(EXPLORE_PREFS);
    }

    function setDirectionsPrefsFromUrl() {
        UserPreferences.setPreference('method', 'directions');
        setPrefsFromUrl(DIRECTIONS_PREFS);
    }

    function buildDirectionsUrlFromPrefs() {
        return '/directions?' + buildUrlParamsFromPrefs(DIRECTIONS_PREFS);
    }


    /* Parses the URL and saves parameter values into local storage
     *
     * Field names in the URL must match those in UserPreferences
     * 'origin' and 'destination' get special handling to convert from coordinates to GeoJSON
     *
     * @param {List[String]} fields : The field names to store values from
     */
    function setPrefsFromUrl(fields) {
        var params = Utils.getUrlParams();
        _.forEach(fields, function(field) {
            // Only set values actually given, don't clobber fields that weren't provided
            if (!_.isUndefined(params[field])) {
                // Special handling for origin and destination, which are stored as GeoJSON
                if (field === 'origin' || field === 'destination') {
                    var coords = _.map(params[field].split(','), parseFloat);
                    var feature = makeFeature(coords, params[field + 'Text']);
                    UserPreferences.setPreference(field, feature);
                } else {
                    UserPreferences.setPreference(field, params[field]);
                }
            }
        });
    }

    /* Reads values for the given fields from local storage and composes a URL query string
     * from them.
     *
     * Only fields for which the preference value is defined will be included, and it won't set
     * undefined fields to default values during lookup.
     */
    function buildUrlParamsFromPrefs(fields) {
        var opts = {};
        _.forEach(fields, function(field) {
            if (field === 'origin' || field === 'destination') {
                var location = UserPreferences.getPreference(field, false);
                if (location && location.feature && location.feature.geometry) {
                    opts[field] = [location.feature.geometry.y, location.feature.geometry.x].join(',');
                }
            } else {
                var val = UserPreferences.getPreference(field, false);
                if (!_.isUndefined(val)) {
                    opts[field] = val;
                }
            }
        });
        return Utils.encodeUrlParams(opts);
    }

    function makeFeature(coords, name) {
        return {
            name: name,
            feature: {
                geometry: {
                    x: coords[1],
                    y: coords[0]
                }
            }
        };
    }

})(_, jQuery, CAC.User.Preferences, CAC.Utils, Navigo);