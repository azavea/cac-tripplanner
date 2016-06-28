/**
 * A basic URL router and related utilities.
 *
 * The app is still based on local storage, but this enables some URL navigation and facilitates
 * the interaction between that and local storage.
 */

CAC.UrlRouting.UrlRouter = (function (_, $, UserPreferences, Utils, Navigo) {

    'use strict';

    // UserPreferences fields that can get written and read from the URL without transformation
    // So NOT including origin and destination, which are coords in URL but objects in storage
    var PREF_FIELDS = ['originText', 'destinationText', 'method', 'mode', 'arriveBy', 'maxWalk',
                       'wheelchair', 'bikeTriangle'];

    var router = null;

    function UrlRouter() {
        router = new Navigo('/map');

        router.on(new RegExp('/directions/?\?'), setPrefsFromDirectionsUrl);

        router.resolve();
    }

    UrlRouter.prototype.updateUrl = updateUrl;
    UrlRouter.prototype.clearUrl = clearUrl;
    UrlRouter.prototype.buildDirectionsUrlFromPrefs = buildDirectionsUrlFromPrefs;
    UrlRouter.prototype.setPrefsFromDirectionsUrl = setPrefsFromDirectionsUrl;

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

    // Builds a URL to the directions view by reading the values in local storage
    function buildDirectionsUrlFromPrefs() {
        var opts = {};
        var origin = UserPreferences.getPreference('origin');
        if (origin && origin.feature && origin.feature.geometry) {
            opts.origin = [origin.feature.geometry.y, origin.feature.geometry.x].join(',');
        }

        var destination = UserPreferences.getPreference('destination');
        if (destination && destination.feature && destination.feature.geometry) {
            opts.destination = [
                destination.feature.geometry.y,
                destination.feature.geometry.x
            ].join(',');
        }

        _.forEach(PREF_FIELDS, function(field) {
            opts[field] = UserPreferences.getPreference(field);
        });

        var url = '/directions?' + _.map(opts, function(val, key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(val); }).join('&');
        return url;
    }

    // Parses the URL and saves the directions parameters in local storage
    function setPrefsFromDirectionsUrl() {
        UserPreferences.setPreference('method', 'directions');
        var params = Utils.getUrlParams();
        if (params.destination) {
            var destCoords = _.map(params.destination.split(','), parseFloat);
            UserPreferences.setPreference('destination',
                                          makeFeature(destCoords, params.destinationText));
        }
        if (params.origin) {
            var originCoords = _.map(params.origin.split(','), parseFloat);
            UserPreferences.setPreference('origin', makeFeature(originCoords, params.originText));
        }
        _.forEach(PREF_FIELDS, function(field) {
            if (!_.isUndefined(params[field])) {
                UserPreferences.setPreference(field, params[field]);
            }
        });
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
