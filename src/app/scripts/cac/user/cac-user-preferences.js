CAC.User.Preferences = (function($) {
    'use strict';

    // set up local storage
    var namespace = 'cac_otp';
    var namespaceStorage = $.initNamespaceStorage(namespace);
    var storage = namespaceStorage.localStorage;

    var defaults = {
        arriveBy: false, // depart at set time, by default
        bikeTriangle: 'neutral',
        exploreTime: 20,
        maxWalk: undefined, // no max
        method: 'explore',
        mode: 'TRANSIT,WALK',
        wheelchair: false
    };

    var module = {
        getPreference: getPreference,
        havePreferences: havePreferences,
        setPreference: setPreference
    };
    return module;

    /**
     * Fetch stored setting.
     *
     * @param {String} preference Name of setting to fetch
     * @return {Object} setting found in storage, or default if none found
     */
    function getPreference(preference) {
        var val = storage.get(preference);
        if (val) {
            val = JSON.parse(val);
        } else {
            val = defaults[preference];
            setPreference(preference, val);
        }
        return val;
    }

    /**
     * Check if there are any settings on the browser.
     *
     * @return {Boolean} true if CAC settings found
    */
    function havePreferences() {
        return !!(storage.get('method'));
    }

    /**
     * Save user preference to local storage (or cookie, if local storage not supported).
     *
     * @param {String} preference Name of setting to store
     * @param {Object} val Setting value to store
     */
    function setPreference(preference, val) {
        storage.set(preference, JSON.stringify(val));
    }

})(jQuery);
