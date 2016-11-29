CAC.User.Preferences = (function(_) {
    'use strict';


    // Initialize preference storage object.
    // It just uses an 'options' dictionary, so preferences lives only as long as
    // the page for which this is initialized.
    // With this setup we have the flexibility to store all or some of the parameters to local
    // storage if we decide that's valuable, and components that use these parameters don't need
    // to know the difference.
    var options = {};
    var storage = {
        set: function (pref, val) { options[pref] = val; },
        get: function (pref) { return options[pref]; }
    };

    var defaults = {
        arriveBy: false, // depart at set time, by default
        bikeTriangle: 'neutral',
        exploreTime: 20,
        maxWalk: 482802, // in meters; set large, since not user-controllable
        method: 'directions',
        mode: 'TRANSIT,WALK',
        origin: undefined,
        originText: '',
        destination: undefined,
        destinationText: '',
        waypoints: [],
        wheelchair: false
    };

    var module = {
        isDefault: isDefault,
        getPreference: getPreference,
        setPreference: setPreference,
        setLocation: setLocation,
        clearLocation: clearLocation
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
        }

        if (!val || val === '') {
            val = defaults[preference];
        }
        return val;
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

    /**
     * Check if value has been set by user, or is a default.
     *
     * @param {String} preference Name of setting to check
     * @return {Boolean} True if getPreference will return a default value
     */
    function isDefault(preference) {
        return !storage.get(preference);
    }

    /**
     * Convenience method to avoid having to manually set both preferences for 'origin' and
     * destination.
     *
     * 'text' is optional and defaults to location.name if omitted
     */
    function setLocation(key, location, text) {
        setPreference(key, location);
        if (!_.isUndefined(text)) {
            setPreference(key + 'Text', text);
        } else {
            setPreference(key + 'Text', location.name);
        }
    }

    // Convenience method to clear 'origin' and 'destination'
    function clearLocation(key) {
        setPreference(key, undefined);
        setPreference(key + 'Text', undefined);
    }

})(_);
