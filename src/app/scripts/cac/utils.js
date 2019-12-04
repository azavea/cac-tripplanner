CAC.Utils = (function (_, moment) {
    'use strict';

    // Map icon settings
    var destinationIconConfig = {
        icon: 'marker-destination',
        prefix: 'icon',
        markerColor: 'red'
    };

    // Note: feed events no longer display on the map
    var feedEventIconConfig = {
        icon: 'calendar',
        markerColor: 'orange',
        prefix: 'fa'
    };

    var highlightIconConfig = {
        icon: 'default',
        prefix: 'icon',
        markerColor: 'darkblue',
    };

    var originIconConfig = {
        icon: 'marker-origin',
        prefix: 'icon',
        markerColor: 'green'
    };

    var outsideTravelshedIconConfig = {
        icon: 'default',
        prefix: 'icon',
        // modified by styles to actually be lightgray, with reduced opacity
        markerColor: 'darkred',
        extraClasses: 'outside'
    };

    var placeIconConfig = {
        icon: 'default',
        prefix: 'icon',
        markerColor: 'lightgray'
    };

    // Direction string mappings
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

    // Map styling for tours
    var dashArray = [5, 8];
    var tourHighlightColor = brandColors.BLUE;

    var defaultCarouselOptions = {
        autoplayButton: false,
        autoplayButtonOutput: false,
        autoplayPosition: 'top',
        controls: false,
        controlPosition: 'bottom',
        items: 1,
        nav: true,
        navPosition: 'bottom',
        preventScrollOnTouch: 'auto',
        slideBy: 'page',
        autoplay: true
    };

    var module = {
        abbrevStreetName: abbrevStreetName,
        convertReverseGeocodeToLocation: convertReverseGeocodeToLocation,
        dashArray: dashArray,
        defaultBackgroundLineColor: defaultBackgroundLineColor,
        defaultCarouselOptions: defaultCarouselOptions,
        defaultModeColor: defaultModeColor,
        destinationIconConfig: destinationIconConfig,
        encodeUrlParams: encodeUrlParams,
        feedEventIconConfig: feedEventIconConfig,
        getBikeOptimizeLabel: getBikeOptimizeLabel,
        getFormattedDistance: getFormattedDistance,
        getImageUrl: getImageUrl,
        getModeColor: getModeColor,
        getUrlParams: getUrlParams,
        highlightIconConfig: highlightIconConfig,
        initializeMoment: initializeMoment,
        modeStringHelper: modeStringHelper,
        originIconConfig: originIconConfig,
        outsideTravelshedIconConfig: outsideTravelshedIconConfig,
        placeIconConfig: placeIconConfig,
        tourHighlightColor: tourHighlightColor
    };

    return Object.freeze(module);

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

    // Return user-facing label for a bike ride type selection
    function getBikeOptimizeLabel(optimizeSelection) {
        var bikeOptimizeStrings = {
            'FLAT': 'Flat ride',
            'QUICK': 'Fast ride',
            'GREENWAYS': 'Safe ride (Default)'
        };

        return _.has(bikeOptimizeStrings, optimizeSelection) ?
            bikeOptimizeStrings[optimizeSelection] :
            bikeOptimizeStrings.GREENWAYS;
    }

    /**
     * Helper function to get formatted string in feet or miles for a given distance in meters
     *
     * @param {double} distanceMeters Distance to format
     * @return {string} distance in miles or feet, rounded, with unit
     */
    function getFormattedDistance(distanceMeters) {
        // less than ~0.2 miles
        if (distanceMeters < 322) {
            var feet = Math.round(distanceMeters * 3.28084).toString();
            return feet === '1' ? feet + ' foot' : feet + ' feet';
        }

        // return miles
        var miles = (Math.round(((distanceMeters / 1000) * 0.621371) * 10) / 10).toString();
        return miles === '1' ? miles + ' mile' : miles + ' miles';
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

    /**
     * Customize moment library. Should be called once, on app initialization.
     */
    function initializeMoment() {
        // Override time duration formatting strings
        // https://momentjs.com/docs/#/customization/relative-time/
        moment.updateLocale('en', {
            relativeTime : {
                s: '%d sec',
                ss: '%d sec',
                m: '%d min',
                mm: '%d min',
                h:  '1 hour',
                hh: '%d hours'
            }
        });

        // Do not round to hour or day. Default is to round at 45 min/22 hours
        // https://momentjs.com/docs/#/customization/relative-time-threshold/
        moment.relativeTimeThreshold('m', 60);
        moment.relativeTimeThreshold('h', 24);
    }

})(_, moment);
