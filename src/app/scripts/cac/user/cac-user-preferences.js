CAC.User.Preferences = (function($) {
    'use strict';

    // set up local storage
    var namespace = 'cac_otp';
    var namespaceStorage = $.initNamespaceStorage(namespace);
    var storage = namespaceStorage.localStorage;

    // store to use for default location
    var cityHall = {
        name: 'Philadelphia City Hall',
        extent: {
            xmax: -75.158978,
            xmin: -75.168978,
            ymax: 39.958449,
            ymin: 39.948449
        },
        feature: {
            attributes: {
                City: 'Philadelphia',
                Postal: '',
                Region: 'Pennsylvania',
                StAddr: '1450 John F Kennedy Blvd'
            },
            geometry: {
                x: -75.16397666699964,
                y: 39.95344911900048
            }
        }
    };

    var defaults = {
        arriveBy: false, // depart at set time, by default
        exploreTime: 20,
        from: undefined, // use current location for directions origin if none set
        fromText: 'Current Location',
        method: 'explore',
        mode: 'TRANSIT,WALK',
        origin: cityHall,
        originText: 'City Hall, Philadelphia, Pennsylvania, USA',
        to: cityHall,
        toText: 'City Hall, Philadelphia, Pennsylvania, USA'
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
