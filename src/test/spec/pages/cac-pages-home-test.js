(function() {
    'use strict';
    var HomePages;

    beforeEach(function(done) {
        var mapDiv = document.createElement('div');
        mapDiv.setAttribute('id', 'map');
        document.body.appendChild(mapDiv);
        HomePages = new CAC.Pages.Home({});
        HomePages.initialize();
        done();
    });

    afterEach(function(done) {
        var mapDiv = document.getElementById('map');
        if (mapDiv) {
            document.body.removeChild(mapDiv);
        }
        HomePages = null;
        done();
    });

    describe('CAC Trip Planner Home Page', function() {
        it('Should have typeahead available', function(done) {
            expect(HomePages.typeaheadExplore).toBeDefined();
            done();
        });
    });

})();
