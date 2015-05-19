(function() {
    'use strict';
    var HomePages;

    beforeEach(function(done) {
        HomePages = new CAC.Pages.Home({});
        HomePages.initialize();
        done();
    });

    describe('CAC Trip Planner Home Page', function() {
        it('Should have typeahead available', function(done) {
            expect(HomePages.typeaheadExplore).toBeDefined();
            done();
        });
    });

})();
