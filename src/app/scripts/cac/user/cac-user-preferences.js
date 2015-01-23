CAC.User.Preferences = (function($, _) {
    'use strict';

    var modePreferences = {WALK: true, TRANSIT: true, BUS: true};
    var module = {
        modePreferences: modePreferences,
        makeModeString: makeModeString
    };
    return module;


    /**
     * Utility function for constructing the correct format of query parameter for OTP
     *
     * @return {string} A mode string of the format 'mode1,mode2,mode3'
     */
    function makeModeString() {
        var keys = _.keys(modePreferences);
        var selectedModes = _.filter(keys, function(key) { return modePreferences[key]; });
        return selectedModes.join(',');
    }

})(jQuery, _);
