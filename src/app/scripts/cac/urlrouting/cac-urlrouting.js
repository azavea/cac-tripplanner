/**
 * A basic URL router and related utilities.
 *
 * The app still uses a UserPreferences component to store and retrieve all parameters, but this
 * enables some URL navigation and facilitates the interaction between that and UserPreferences.
 */

CAC.UrlRouting.UrlRouter = (function (_, $, UserPreferences, Utils, route) {

    'use strict';

    // User pref parameters for different views
    var SHARED_ENCODE = ['origin',
                         'originText',
                         'mode',
                         'maxWalk',
                         'wheelchair',
                         'bikeOptimize',
                         'arriveBy',
                         'dateTime'];

    var EXPLORE_ENCODE = SHARED_ENCODE.concat(['placeId', 'exploreMinutes']);

    var DIRECTIONS_ENCODE = SHARED_ENCODE.concat(['destination',
                                                  'destinationText',
                                                  'tourMode',
                                                  'waypoints']);

    var events = $({});
    var eventNames = {
        changed: 'cac:control:urlrouting:changed'
    };

    var updatingUrl = false;

    function UrlRouter() {
        route.base('/');
        route('explore..', loadExplore);
        route('..', function () {
            var path = location.pathname;
            if (updatingUrl) {
                // If we're updating the URL from the directions or explore controllers, we
                // don't want to run setPrefsFromUrl again.
                updatingUrl = false;
                return;
            } else if (path !== '/' && path !== '/context.html') {
                // We actually only want to do client-side routing for `/` and
                // `/explore`, but Riot will hijack clicks on any anchor tag
                // that matches our base of `/`.
                //
                // To work-around that behaviour, we force a refesh of the page
                // after the URL changes to something other than `/` or `/explore`
                // Note: We treat `/context.html` the same as `/`. This URL
                // isn't used by the application, but is used by the JS test runner
                location.reload();
            } else {
                setPrefsFromUrl();
            }
        });
        route.start(true);
    }

    UrlRouter.prototype.updateUrl = updateUrl;
    UrlRouter.prototype.clearUrl = clearUrl;
    UrlRouter.prototype.buildExploreUrlFromPrefs = buildExploreUrlFromPrefs;
    UrlRouter.prototype.buildDirectionsUrlFromPrefs = buildDirectionsUrlFromPrefs;
    UrlRouter.prototype.directionsPrefsMissingFromUrl = directionsPrefsMissingFromUrl;
    UrlRouter.prototype.events = events;
    UrlRouter.prototype.eventNames = eventNames;

    return UrlRouter;

    /* Updates the displayed URL without triggering any routing callbacks. It prevents unwanted
     * routing callbacks by:
     * 1. Checking whether it's being asked to update the URL to the current URL. This can happen
     *    if e.g. a `Directions.planTrip` is triggered by browser navigation. The change in URL
     *    will trigger the controllers to update, but they needn't/shouldn't re-update the URL,
     *    since that will muddy up the history. It's hard to differentiate that case in a way that
     *    can be checked inside the controllers, so handle it here.
     * 2. Setting `updatingUrl`, which gets read by the routing handler as a signal to cancel.
     */
    function updateUrl(url, replaceState) {
        if (decodeURI(location.pathname + location.search) === decodeURI(url)) {
            return;
        }
        updatingUrl = true;
        route(url, undefined /* Title */, replaceState);
    }

    function clearUrl() {
        updateUrl('/');
    }

    function buildExploreUrlFromPrefs() {
        return '/?' + buildUrlParamsFromPrefs(EXPLORE_ENCODE);
    }

    /* Enables direct linking to the blank Explore view (i.e. from the Learn tab)
     *
     * Sets the 'mode' preference, which causes the javascript to initialize with the Explore view
     * active, but clears the URL because the URL-manipulation done by Directions and Explore
     * assume/require that they be at /
     */
    function loadExplore() {
        UserPreferences.setPreference('method', 'explore');
        updatingUrl = true;
        route('/', undefined /* Title */, true /* replace state */);
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
            setPrefs(DIRECTIONS_ENCODE, params);
        } else if (params.origin) {
            UserPreferences.setPreference('method', 'explore');
            setPrefs(EXPLORE_ENCODE, params);
        } else {
            UserPreferences.setPreference('method', undefined);
        }

        // set bike share preference separate from mode
        if (params.mode) {
            var bikeShare = params.mode.indexOf('_RENT') >= 0;
            UserPreferences.setPreference('bikeShare', bikeShare, true);
        }
        events.trigger(eventNames.changed);
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
                        UserPreferences.setPreference(field, undefined, true);
                    } else {
                        var location = makeLocation(coords, params[field + 'Text']);
                        UserPreferences.setPreference(field, location, true);
                    }
                } else if (field === 'waypoints') {
                    var waypoints = _.map(params[field].split(';'), function(waypoint) {
                        var coords = _.map(waypoint.split(','), parseFloat);
                        if (!isNaN(coords[0])) {
                            return coords;
                        }
                    });
                    UserPreferences.setPreference(field, waypoints, true);
                } else if (field === 'dateTime') {
                    if (!params[field]) {
                        UserPreferences.setPreference(field, undefined, true);
                    } else {
                        UserPreferences.setPreference(field, parseInt(params[field]), true);
                    }
                } else {
                    UserPreferences.setPreference(field, params[field], true);
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
        return Utils.encodeUrlParams(getPreferencesWithDefaults(fields));
    }

    function directionsPrefsMissingFromUrl(url) {
        return prefsMissingFromUrl(DIRECTIONS_ENCODE, url);
    }

    function prefsMissingFromUrl(fields, url) {
        var params = Utils.getUrlParams();
        var prefs = getPreferencesWithDefaults(fields);
        if (Object.keys(params).length === 0) {
            return false;
        }

        return _.some(fields, function(field) {
            return _.isUndefined(params[field]) != _.isUndefined(prefs[field]);
        });
    }

    function getPreferencesWithDefaults(fields){
        // Write lat/lon with ~1cm precision. should be sufficient and makes URLs nicer.
        var COORDINATE_ROUND = 7;
        var opts = {};
        _.forEach(fields, function(field) {
            if (field === 'origin' || field === 'destination') {
                var place = UserPreferences.getPreference(field, false);
                if (place && place.location) {
                    opts[field] = [_.round(place.location.y, COORDINATE_ROUND),
                                   _.round(place.location.x, COORDINATE_ROUND)
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
        return opts;
    }

    function makeLocation(coords, name) {
        return {
            address: name,
            location: {
                x: coords[1],
                y: coords[0]
            }
        };
    }

})(_, jQuery, CAC.User.Preferences, CAC.Utils, route);
