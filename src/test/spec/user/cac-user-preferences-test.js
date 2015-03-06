(function() {
    'use strict';
    var UserPreferences;

    beforeEach(function(done) {
        UserPreferences = CAC.User.Preferences;
        done();
    });

    describe('CAC User Preferences', function() {
        it('Should store and retrieve a setting', function(done) {
            UserPreferences.setPreference('foo', {answer: 42});
            var val = UserPreferences.getPreference('foo');
            expect(val.answer).toEqual(42);
            done();
        });

        it('Should fetch a default setting', function(done) {
            var val = UserPreferences.getPreference('fromText');
            expect(val).toEqual('Current Location');
            done();
        });
    });

})();
