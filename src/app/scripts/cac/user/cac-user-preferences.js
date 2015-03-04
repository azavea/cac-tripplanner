CAC.User.Preferences = (function($) {
    'use strict';

    var namespace = 'cac_';
    var namespaceStorage = null;
    var storage = null;
    var defaults = {
        mode: 'WALK,TRANSIT'
    };

    var module = {
        getPreference: getPreference,
        setPreference: setPreference
    };
    return module;

    function getPreference(preference) {
        initializeStorage();
        var val = storage.get(preference);
        if (!val) {
            var useDefault = defaults[preference];
            val = useDefault;
            setPreference(preference, useDefault);
        }
        return val;
    }

    function setPreference(preference, val) {
        initializeStorage();
        storage.set(preference, val);
    }

    function initializeStorage() {
        if (!storage) {
            namespaceStorage = $.initNamespaceStorage(namespace);
            storage = namespaceStorage.localStorage;
        }
    }

})(jQuery);
