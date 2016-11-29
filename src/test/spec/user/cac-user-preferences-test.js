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
            var val = UserPreferences.getPreference('method');
            expect(val).toEqual('directions');
            done();
        });

        it('Should have no location default setting', function(done) {
            var val = UserPreferences.getPreference('fromText');
            expect(val).toBeUndefined();
            done();
        });
    });

})();
