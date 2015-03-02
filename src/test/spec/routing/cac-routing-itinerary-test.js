(function() {
    'use strict';
    var RoutingItinerary;

    beforeEach(function(done) {
        RoutingItinerary = new CAC.Routing.Itinerary('foo', 123);
        done();
    });

    describe('CAC Trip Planner Routing Itinerary', function() {
        it('Should have highlight available', function(done) {
            expect(RoutingItinerary.highlight).toBeDefined();
            done();
        });
    });

})();
