CAC.Utils = (function () {
    'use strict';

    var module = {
        getImageUrl: getImageUrl,
        abbrevStreetName: abbrevStreetName
    };

    return module;

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

})();
