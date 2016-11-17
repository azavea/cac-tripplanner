/**
 * A basic URL router and related utilities.
 *
 * The app still uses a UserPreferences component to store and retrieve all parameters, but this
 * enables some URL navigation and facilitates the interaction between that and UserPreferences.
 */

CAC.UrlRouting.UrlRouter = (function (_, $, UserPreferences, Utils, Navigo) {

    'use strict';

    // User pref parameters for different views
    var SHARED_ENCODE = ['origin', 'originText', 'mode'];
    var SHARED_READ = ['maxWalk', 'wheelchair', 'bikeTriangle'];
    var EXPLORE_ENCODE = SHARED_ENCODE.concat(['placeId', 'exploreTime']);
    var EXPLORE_READ = EXPLORE_ENCODE.concat(SHARED_READ);
    var DIRECTIONS_ENCODE = SHARED_ENCODE.concat(['destination', 'destinationText', 'waypoints']);
    var DIRECTIONS_READ = DIRECTIONS_ENCODE.concat(SHARED_READ).concat(['arriveBy']);

    var router = null;

    function UrlRouter() {
        router = new Navigo('/');
        router.on('/', setPrefsFromUrl);
        router.resolve();
    }

    UrlRouter.prototype.updateUrl = updateUrl;
    UrlRouter.prototype.clearUrl = clearUrl;
    UrlRouter.prototype.buildExploreUrlFromPrefs = buildExploreUrlFromPrefs;
    UrlRouter.prototype.buildDirectionsUrlFromPrefs = buildDirectionsUrlFromPrefs;

    return UrlRouter;

    // Updates the displayed URL without triggering any routing callbacks
    function updateUrl(url) {
        router.pause(true);
        router.navigate(url, true);
        router.pause(false);
    }

    function clearUrl() {
        updateUrl('');
    }

    function buildExploreUrlFromPrefs() {
        return '/?' + buildUrlParamsFromPrefs(EXPLORE_ENCODE);
    }

    /* Read URL parameters into user preferences
     *
     * Figures out whether to set 'directions' or 'explore' based on whether destination and
     * origin are present, then calls setPrefs to read the appropriate parameters into
     * UserPreferences.
     *
     * Does nothing if there's no origin or destination (i.e. the home view with no query params)
     */
    function setPrefsFromUrl() {
        var params = Utils.getUrlParams();
        if (params.destination) {
            UserPreferences.setPreference('method', 'directions');
            setPrefs(DIRECTIONS_READ, params);
        } else if (params.origin) {
            UserPreferences.setPreference('method', 'explore');
            setPrefs(EXPLORE_READ, params);
        }
    }

    function buildDirectionsUrlFromPrefs() {
        return '/?' + buildUrlParamsFromPrefs(DIRECTIONS_ENCODE);
    }


    /* Saves the URL query parameter values to UserPreferences
     *
     * Field names in the URL must match those in UserPreferences
     * 'origin' and 'destination' get special handling to convert from coordinates to GeoJSON
     *
     * Fields that are included but blank will be saved as blank (empty string) except
     * for origin and destination, which get set to undefined.
     *
     * Fields that are omitted will be ignored, not unset, so anything that uses those params will
     * get what's already in UserPreferences or else the default.
     *
     * @param {List[String]} fields : The field names to store values from
     */
    function setPrefs(fields, params) {
        _.forEach(fields, function(field) {
            // Only set values actually given, don't clobber fields that weren't provided
            if (!_.isUndefined(params[field])) {
                // Special handling for origin and destination, which are stored as GeoJSON
                if (field === 'origin' || field === 'destination') {
                    var coords = _.map(params[field].split(','), parseFloat);
                    if (isNaN(coords[0])) {
                        UserPreferences.setPreference(field, undefined);
                    } else {
                        var feature = makeFeature(coords, params[field + 'Text']);
                        UserPreferences.setPreference(field, feature);
                    }
                } else if (field === 'waypoints') {
                    var waypoints = _.map(params[field].split(';'), function(waypoint) {
                        var coords = _.map(waypoint.split(','), parseFloat);
                        if (!isNaN(coords[0])) {
                            return coords;
                        }
                    });
                    UserPreferences.setPreference(field, waypoints);
                } else {
                    UserPreferences.setPreference(field, params[field]);
                }
            }
        });
    }

    /* Reads values for the given fields from UserPreferences and composes a URL query string
     * from them.
     *
     * It won't set undefined fields to default values during lookup. Undefined preferences get
     * encoded as empty string.
     */
    function buildUrlParamsFromPrefs(fields) {
        // Write lat/lon with ~1cm precision. should be sufficient and makes URLs nicer.
        var COORDINATE_ROUND = 7;

        var opts = {};
        _.forEach(fields, function(field) {
            if (field === 'origin' || field === 'destination') {
                var location = UserPreferences.getPreference(field, false);
                if (location && location.feature && location.feature.geometry) {
                    opts[field] = [_.round(location.feature.geometry.y, COORDINATE_ROUND),
                                   _.round(location.feature.geometry.x, COORDINATE_ROUND)
                                  ].join(',');
                } else {
                    opts[field] = '';
                }
            } else if (field === 'waypoints') {
                var waypoints = UserPreferences.getPreference(field);
                if (waypoints && waypoints.length) {
                    opts[field] = _.map(waypoints, function(waypoint) {
                        return [_.round(waypoint[0], COORDINATE_ROUND),
                                _.round(waypoint[1], COORDINATE_ROUND)].join(',');
                    }).join(';');
                }
            } else {
                var val = UserPreferences.getPreference(field, false);
                if (!_.isUndefined(val)) {
                    opts[field] = val;
                } else {
                    opts[field] = '';
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
