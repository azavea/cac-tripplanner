(function() {
    'use strict';
    var RoutingItinerary;

    beforeEach(function(done) {
        var otpItinerary = {
            'duration': 330,
            'startTime': 1428070667000,
            'endTime': 1428070997000,
            'walkTime': 328,
            'transitTime': 0,
            'waitingTime': 2,
            'walkDistance': 405.1809699203602,
            'walkLimitExceeded': false,
            'elevationLost': 0,
            'elevationGained': 0,
            'transfers': 0,
            'fare': {
                'fare': {
                    'regular': {
                        'currency': {
                            'symbol': '$',
                            'currency': 'USD',
                            'currencyCode': 'USD',
                            'defaultFractionDigits': 2
                        },
                        'cents': 225
                    }
                }
            },
            'legs': [
                {
                    'startTime': 1428070667000,
                    'endTime': 1428070739000,
                    'departureDelay': 0,
                    'arrivalDelay': 0,
                    'realTime': false,
                    'distance': 84.91700000000002,
                    'pathway': false,
                    'mode': 'WALK',
                    'route': '',
                    'agencyTimeZoneOffset': -14400000,
                    'interlineWithPreviousLeg': false,
                    'from': {
                        'name': 'Market Street',
                        'lon': -75.14805853101251,
                        'lat': 39.95042463771413,
                        'departure': 1428070667000,
                        'orig': ''
                    },
                    'to': {
                        'name': '4th St & Market St',
                        'stopId': 'F1:850',
                        'lon': -75.147309,
                        'lat': 39.950481,
                        'arrival': 1428070739000,
                        'departure': 1428070740000,
                        'zoneId': '1',
                        'stopIndex': 90,
                        'stopSequence': 92
                    },
                    'legGeometry': {
                        'points': 'cyyrFjjtiMN}BBa@IAQC',
                        'length': 5
                    },
                    'rentedBike': false,
                    'duration': 72,
                    'transitLeg': false,
                    'steps': [
                        {
                            'distance': 69.32300000000001,
                            'relativeDirection': 'DEPART',
                            'streetName': 'Market Street',
                            'absoluteDirection': 'EAST',
                            'stayOn': false,
                            'area': false,
                            'bogusName': false,
                            'lon': -75.14805853101251,
                            'lat': 39.95042463771413,
                            'elevation': [
                                {
                                    'first': 0,
                                    'second': 0
                                },
                                {
                                    'first': 5.41,
                                    'second': 0
                                },
                                {
                                    'first': 15.41,
                                    'second': 0
                                },
                                {
                                    'first': 25.41,
                                    'second': 0
                                },
                                {
                                    'first': 35.41,
                                    'second': 0
                                },
                                {
                                    'first': 45.41,
                                    'second': 0
                                },
                                {
                                    'first': 129.5,
                                    'second': 0
                                }
                            ]
                        },
                        {
                            'distance': 15.594000000000001,
                            'relativeDirection': 'LEFT',
                            'streetName': 'North 4th Street',
                            'absoluteDirection': 'NORTH',
                            'stayOn': false,
                            'area': false,
                            'bogusName': false,
                            'lon': -75.1472571,
                            'lat': 39.9503247,
                            'elevation': [
                                {
                                    'first': 0,
                                    'second': 0
                                },
                                {
                                    'first': 5.79,
                                    'second': 0
                                },
                                {
                                    'first': 5.787,
                                    'second': 0
                                },
                                {
                                    'first': 15.597000000000001,
                                    'second': 0
                                }
                            ]
                        }
                    ]
                },
                {
                    'startTime': 1428070740000,
                    'endTime': 1428070740000,
                    'departureDelay': 0,
                    'arrivalDelay': 0,
                    'realTime': false,
                    'distance': 175.77253675099556,
                    'pathway': false,
                    'mode': 'BUS',
                    'route': '57',
                    'agencyName': 'SEPTA',
                    'agencyUrl': 'http://www.septa.org',
                    'agencyTimeZoneOffset': -14400000,
                    'routeType': 3,
                    'routeId': '13840',
                    'interlineWithPreviousLeg': false,
                    'tripBlockId': '7452',
                    'headsign': 'Whitman Plaza',
                    'agencyId': 'F1',
                    'tripId': '4415763',
                    'serviceDate': '20150403',
                    'from': {
                        'name': '4th St & Market St',
                        'stopId': 'F1:850',
                        'lon': -75.147309,
                        'lat': 39.950481,
                        'arrival': 1428070739000,
                        'departure': 1428070740000,
                        'zoneId': '1',
                        'stopIndex': 90,
                        'stopSequence': 92
                    },
                    'to': {
                        'name': '4th St & Chestnut St',
                        'stopId': 'F1:18094',
                        'lon': -75.147634,
                        'lat': 39.94892,
                        'arrival': 1428070740000,
                        'departure': 1428070741000,
                        'zoneId': '1',
                        'stopIndex': 91,
                        'stopSequence': 93
                    },
                    'legGeometry': {
                        'points': 'myyrFfetiMXD|ARhANPBVBjAL',
                        'length': 7
                    },
                    'routeShortName': '57',
                    'routeLongName': 'WhitmanPlaza to Fern Rock Trans Ctr',
                    'rentedBike': false,
                    'duration': 0,
                    'transitLeg': true,
                    'steps': []
                },
                {
                    'startTime': 1428070741000,
                    'endTime': 1428070997000,
                    'departureDelay': 0,
                    'arrivalDelay': 0,
                    'realTime': false,
                    'distance': 320.1260000000001,
                    'pathway': false,
                    'mode': 'WALK',
                    'route': '',
                    'agencyTimeZoneOffset': -14400000,
                    'interlineWithPreviousLeg': false,
                    'from': {
                        'name': '4th St & Chestnut St',
                        'stopId': 'F1:18094',
                        'lon': -75.147634,
                        'lat': 39.94892,
                        'arrival': 1428070740000,
                        'departure': 1428070741000,
                        'zoneId': '1',
                        'stopIndex': 91,
                        'stopSequence': 93
                    },
                    'to': {
                        'name': 'Chestnut Street',
                        'lon': -75.14417104405766,
                        'lat': 39.948357448838294,
                        'arrival': 1428070997000,
                        'orig': ''
                    },
                    'legGeometry': {
                        'points': 'soyrFhgtiMLBJgBDk@RmC@W@QRkCLmBJ_BBWCV',
                        'length': 12
                    },
                    'rentedBike': false,
                    'duration': 256,
                    'transitLeg': false,
                    'steps': [
                        {
                            'distance': 7.372,
                            'relativeDirection': 'DEPART',
                            'streetName': 'South 4th Street',
                            'absoluteDirection': 'SOUTH',
                            'stayOn': false,
                            'area': false,
                            'bogusName': false,
                            'lon': -75.14756589542495,
                            'lat': 39.94890531565414,
                            'elevation': []
                        },
                        {
                            'distance': 302.8850000000001,
                            'relativeDirection': 'LEFT',
                            'streetName': 'Chestnut Street',
                            'absoluteDirection': 'EAST',
                            'stayOn': false,
                            'area': false,
                            'bogusName': false,
                            'lon': -75.14758,
                            'lat': 39.9488399,
                            'elevation': []
                        },
                        {
                            'distance': 9.869,
                            'relativeDirection': 'HARD_LEFT',
                            'streetName': 'Chestnut Street',
                            'absoluteDirection': 'WEST',
                            'stayOn': true,
                            'area': false,
                            'bogusName': false,
                            'lon': -75.1440781,
                            'lat': 39.9483788,
                            'elevation': []
                        }
                    ]
                }
            ],
            'tooSloped': false
        };
        var requestParams = {};
        RoutingItinerary = new CAC.Routing.Itinerary(otpItinerary, 123, requestParams);
        done();
    });

    describe('CAC Trip Planner Routing Itinerary', function() {
        it('Should have highlight available', function(done) {
            expect(RoutingItinerary.highlight).toBeDefined();
            done();
        });
    });

})();
