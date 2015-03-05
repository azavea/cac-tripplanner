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
        mode: 'WALK,TRANSIT',
        origin: cityHall,
        from: null, // use current location for directions origin if none set
        to: cityHall,
        fromText: 'Current Location',
        toText: 'City Hall, Philadelphia, Pennsylvania, USA',
        originText: 'City Hall, Philadelphia, Pennsylvania, USA',
        exploreTime: 20
    };

    var module = {
        getPreference: getPreference,
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
            var useDefault = defaults[preference];
            val = useDefault;
            setPreference(preference, useDefault);
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

})(jQuery);
