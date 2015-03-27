CAC.Utils = (function (_) {
    'use strict';

    var module = {
        convertDestinationToFeature: convertDestinationToFeature,
        getImageUrl: getImageUrl,
        abbrevStreetName: abbrevStreetName,
        getUrlParams: getUrlParams
    };

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

    return module;

    /**
     * Convert destination from search endpoint into a feature formatted like typeahead results.
     * TODO: Featured destinations should probably be in the typeahead.
     *
     * @param {Object} destination JSON object returned from destination search endpoint
     * @returns {Object} Feature object structured like the typahead results, for use on map page.
     */
    function convertDestinationToFeature(destination) {
        var feature = {
            name: destination.name,
            extent: {
                xmax: destination.point.coordinates[0],
                xmin: destination.point.coordinates[0],
                ymax: destination.point.coordinates[1],
                ymin: destination.point.coordinates[1]
            },
            feature: {
                attributes: {
                    City: destination.city,
                    Postal: destination.zip,
                    Region: destination.state,
                    StAddr: destination.address
                },
                geometry: {
                    x: destination.point.coordinates[0],
                    y: destination.point.coordinates[1]
                }
            }
        };
        return feature;
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
                    return item.split('=');
                }
                return undefined;
            })
            // Remove undefined in the case the search is empty
            .compact()
            // Turn [key, value] arrays into object parameters
            .object()
            // Return the value of the chain operation
            .value();
    }

})(_);
