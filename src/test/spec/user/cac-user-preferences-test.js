(function() {
    'use strict';
    var UserPreferences;

    beforeEach(function(done) {
        UserPreferences = CAC.User.Preferences;
        UserPreferences.clearSettings();
        done();
    });

    describe('CAC User Preferences', function() {
        it('Should store and retrieve a setting', function(done) {
            UserPreferences.setPreference('foo', {answer: 42});
            var val = UserPreferences.getPreference('foo');
            expect(val.answer).toEqual(42);
            expect(UserPreferences.isDefault('foo')).toBe(false);
            done();
        });

        it('Should fetch a default setting', function(done) {
            var val = UserPreferences.getPreference('method');
            expect(val).toEqual('directions');
            done();
        });

        it('Should have no location default setting', function(done) {
            var val = UserPreferences.getPreference('origin');
            expect(val).toBeUndefined();
            done();
        });

        it('Should know whether a preference is a defualt value or not', function(done) {
            // is default, not set by user
            expect(UserPreferences.isDefault('method')).toBe(true);

            // is neither default nor user-set
            expect(UserPreferences.isDefault('razzmatazz')).toBe(false);

            // is user set and not in defaults
            UserPreferences.setPreference('foo', {answer: 42});
            expect(UserPreferences.isDefault('foo')).toBe(false);

            // is in defaults, but overridden by user setting
            UserPreferences.setPreference('bikeTriangle', 'warp7');
            expect(UserPreferences.isDefault('bikeTriangle')).toBe(false);

            done();
        });

        it('Should fall back on default value when not set by user', function(done) {
            // is in defaults but not in user settings
            expect(UserPreferences.getPreference('bikeTriangle')).toEqual('any');

            // is in defaults, but overridden by user setting
            UserPreferences.setPreference('bikeTriangle', 'warp7');
            expect(UserPreferences.getPreference('bikeTriangle')).toEqual('warp7');

            done();
        });

        it('Should set and unset user values', function(done) {

            // set somemthing not in defaults
            UserPreferences.setPreference('warpspeed', '7');
            expect(UserPreferences.getPreference('warpspeed')).toEqual('7');

            // unset it
            UserPreferences.setPreference('warpspeed', undefined);
            expect(UserPreferences.getPreference('warpspeed')).toBeUndefined();

            // now set it to a value that is falsy (before being stringified)
            UserPreferences.setPreference('warpspeed', false);
            // ensure that it is *not* unset
            expect(UserPreferences.getPreference('warpspeed')).toBe(false);

            done();
        });
    });

})();
