CAC.Utils = (function (_) {
    'use strict';

    var directions = {
        north: 'N',
        northeast: 'NE',
        east: 'E',
        southeast: 'SE',
        south: 'S',
        southwest: 'SW',
        west: 'W',
        northwest: 'NW',
        n: 'N',
        ne: 'NE',
        e: 'E',
        se: 'SE',
        s: 'S',
        sw: 'SW',
        w: 'W',
        nw: 'NW'
    };

    var abbreviations = {
        ave: 'Ave',
        avenue: 'Ave',
        blvd: 'Blvd',
        boulevard: 'Blvd',
        court: 'Ct',
        ct: 'Ct',
        dr: 'Dr',
        drive: 'Dr',
        expressway: 'Expwy',
        expwy: 'Expwy',
        freeway: 'Fwy',
        fwy: 'Fwy',
        highway: 'Hwy',
        hwy: 'Hwy',
        lane: 'Ln',
        ln: 'Ln',
        parkway: 'Pkwy',
        pkwy: 'Pkwy',
        pl: 'Pl',
        place: 'Pl',
        rd: 'Rd',
        road: 'Rd',
        st: 'St',
        street: 'St',
        ter: 'Ter',
        terrace: 'Ter',
        tr: 'Tr',
        trail: 'Tr',
        way: 'Wy',
        wy: 'Wy',
    };

    // Note:  the three bike options must sum to 1, or OTP won't plan the trip
    var bikeTriangle = {
        any: {
            triangleSafetyFactor: 0.34,
            triangleSlopeFactor: 0.33,
            triangleTimeFactor: 0.33
        },
        flat: {
            triangleSafetyFactor: 0.17,
            triangleSlopeFactor: 0.66,
            triangleTimeFactor: 0.17
        },
        fast: {
            triangleSafetyFactor: 0.17,
            triangleSlopeFactor: 0.17,
            triangleTimeFactor: 0.66
        },
        safe: {
            triangleSafetyFactor: 0.66,
            triangleSlopeFactor: 0.17,
            triangleTimeFactor: 0.17
        }
    };

    // linestring colors for each mode
    var brandColors = {
        BLUE: '#2e68a3',
        GREEN: '#60a244',
        YELLOW: '#efa722',
        PURPLE: '#6a4388',
        ORANGE: '#f05223',
        RED: '#e23331'
    };
    var defaultModeColor = brandColors.RED;
    var defaultBackgroundLineColor = '#8B9cae';
    var modeColors = {
        WALK: brandColors.BLUE,
        BICYCLE: brandColors.PURPLE,
        BUS: brandColors.YELLOW,
        TRAM: brandColors.YELLOW,
        SUBWAY: brandColors.YELLOW,
        TRAIN: brandColors.YELLOW,
        RAIL: brandColors.YELLOW,
        CAR: '#111111',
        FERRY: brandColors.YELLOW
    };

    var module = {
        getBikeTriangle: getBikeTriangle,
        convertReverseGeocodeToLocation: convertReverseGeocodeToLocation,
        defaultBackgroundLineColor: defaultBackgroundLineColor,
        defaultModeColor: defaultModeColor,
        getImageUrl: getImageUrl,
        abbrevStreetName: abbrevStreetName,
        getUrlParams: getUrlParams,
        encodeUrlParams: encodeUrlParams,
        getModeColor: getModeColor,
        modeStringHelper: modeStringHelper
    };

    return Object.freeze(module);

    /**
     * Get OTP values for the bikeTriangle parameter, which weights based on
     * relative preference for safety, speed, or flatness of route.
     *
     * @param {string} option Key for which option to prefer
     * @returns {Object} Values that sum to 1 and weight for the preferred option
     */
    function getBikeTriangle(option) {
        if (_.has(bikeTriangle, option)) {
            return bikeTriangle[option];
        }

        console.error('bike triangle option ' + option + ' not found');
        return bikeTriangle.any;
    }

    /**
     * Convert ESRI reverse geocode response into location formatted like typeahead results.
     *
     * @param {Object} response JSON response from ESRI reverse geocode service
     * @returns {Object} Location object structured like the typeahead results, for use on map page.
     */
    function convertReverseGeocodeToLocation(response) {
        var location = {
            location: {
                x: response.location.x,
                y: response.location.y
            },
            /*jshint camelcase: false */
            address: response.address.Match_addr,
            /*jshint camelcase: true */
            extent: {
                xmax: response.location.x,
                xmin: response.location.x,
                ymax: response.location.y,
                ymin: response.location.y
            },
            attributes: {
                City: response.address.City,
                Postal: response.address.Postal,
                Region: response.address.Region,
                StAddr: response.address.Address,
            },
        };
        return location;
    }

    // Source: https://github.com/azavea/nih-wayfinding/blob/develop/src/nih_wayfinding/app/scripts/routing/abbreviate-filter.js
    function abbrevStreetName(streetAddress) {
        if (!(_.isString(streetAddress) && streetAddress.length)) {
            return streetAddress;
        }
        var parts = streetAddress.trim().split(/\s+/);
        var keys = streetAddress.toLowerCase().trim().split(/\s+/);

        // Remove street number if first item in parts
        var streetNumber = parseInt(parts[0], 10);
        if (!isNaN(streetNumber)) {
            parts = parts.slice(1);
            keys = keys.slice(1);
        }
        var numParts = parts.length;
        var numKeys = parts.length;

        // Example "North Baltimore Avenue"
        if (numParts >= 3 && _.has(directions, keys[0]) && _.has(abbreviations, keys[numKeys-1])) {
            parts[0] = directions[keys[0]];
            parts[numParts-1] = abbreviations[keys[numKeys-1]];
        // Example "Baltimore Avenue North"
        } else if (numParts >= 3 && _.has(abbreviations, keys[numKeys-2]) && _.has(directions, keys[numKeys-1])) {
            parts[numParts-2] = abbreviations[keys[numKeys-2]];
            parts[numParts-1] = directions[keys[numKeys-1]];
        } else if (numParts >= 2 && _.has(abbreviations, keys[numKeys-1])) {
             parts[numParts-1] = abbreviations[keys[numKeys-1]];
        }

        // Readd street number if it was actually a number
        if (!isNaN(streetNumber)) {
            parts.splice(0, 0, streetNumber);
        }
        return parts.join(' ');
    }

    // Use with images in the app/images folder
    function getImageUrl(imageName) {
        return '/static/images/' + imageName;
    }

    // Parses URL parameters and returns them as an object
    function getUrlParams() {
        // Code borrowed from: http://www.timetler.com/2013/11/14/location-search-split-one-liner/
        // Remove the '?' at the start of the string and split out each assignment
        return _.chain(location.search.slice(1).split('&'))
            // Split each array item into [key, value]
            // ignore empty string if search is empty
            .map(function(item) {
                if (item) {
                    var itm = item.split('=');
                    if (itm.length > 1) {
                        // decode parameters before passing them on to OTP
                        itm[1] = decodeURIComponent(itm[1]);
                        // convert boolean values stored as strings back to booleans
                        if (itm[1] === 'false') {
                            itm[1] = false;
                        } else if (itm[1] === 'true') {
                            itm[1] = true;
                        }
                    }
                    return itm;
                }
                return undefined;
            })
            // Remove undefined in the case the search is empty
            .compact()
            // Turn [key, value] arrays into object parameters
            .fromPairs()
            // Return the value of the chain operation
            .value();
    }

    function encodeUrlParams(params) {
        return _.map(params, function(val, key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(val);
        }).join('&');
    }

    function getModeColor(modeString) {
        return modeColors[modeString] || defaultModeColor;
    }

    function modeStringHelper(modeString) {
        var modeIcons = {
            BUS: {name: 'bus', font: 'icon'},
            SUBWAY: {name: 'subway', font: 'icon'},
            CAR: {name: 'car', font: 'icon'},
            TRAIN: {name: 'train', font: 'icon'},
            RAIL: {name: 'train', font: 'icon'},
            BICYCLE: {name: 'bike', font: 'icon'},
            WALK: {name: 'walk', font: 'icon'},
            TRAM: {name: 'tram', font: 'icon'},
            FERRY: {name: 'ferry', font: 'icon'}
        };

        var mode = modeIcons[modeString];

        if (!mode) {
            mode = {name: 'default', font: 'icon'};
            console.error('Unrecognized transit mode: ' + modeString + '. Using default icon.');
        }

        var modeStr = ['<i class="',
                        mode.font,
                        ' ',
                        mode.font,
                        '-',
                        mode.name,
                        '"></i>'
                      ].join('');
        return modeStr;
    }

})(_);
