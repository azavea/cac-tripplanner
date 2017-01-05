CAC.Control.DirectionsFormControl = (function ($, Typeahead, Geocoder, UserPreferences, Utils) {
    'use strict';

    var defaults = {
        selectors: {
            // origin/destination switcher
            reverseButton: '.btn-reverse',

            // directions form selectors
            directionsForm: '.directions-form-element',
            directionsFrom: '.directions-from',
            directionsTo: '.directions-to',

            // typeahead
            typeaheadFrom: '#input-directions-from',
            typeaheadTo: '#input-directions-to',

            // used for error display
            origin: '.directions-from.directions-text-input',
            destination: '.directions-to.directions-text-input',
            alert: '.alert',

            errorClass: 'error',
        }
    };
    var events = $({});
    var eventNames = {
        reversed: 'cac:control:directionsform:reversed',
        selected: 'cac:control:directionsform:selected',
        cleared: 'cac:control:directionsform:cleared',
        geocodeError: 'cac:control:directionsform:geocodeerror'
    };
    var options = {};

    var typeaheadTo = null;
    var typeaheadFrom = null;
    var typeaheads = {};


    function DirectionsFormControl(params) {
        options = $.extend({}, defaults, params);
        this.options = options;
        this.initialize();
    }

    DirectionsFormControl.prototype = {
        initialize: initialize,
        events: events,
        eventNames: eventNames,
        moveOriginDestination: moveOriginDestination,
        clearAll: clearAll,
        setLocation: setLocation,
        setError: setError,
        setFromUserPreferences: setFromUserPreferences
    };

    return DirectionsFormControl;

    function initialize() {
        typeaheadTo = new Typeahead(options.selectors.typeaheadTo);
        typeaheadTo.events.on(typeaheadTo.eventNames.selected, onTypeaheadSelected);
        typeaheadTo.events.on(typeaheadTo.eventNames.cleared, onTypeaheadCleared);

        typeaheadFrom = new Typeahead(options.selectors.typeaheadFrom);
        typeaheadFrom.events.on(typeaheadFrom.eventNames.selected, onTypeaheadSelected);
        typeaheadFrom.events.on(typeaheadFrom.eventNames.cleared, onTypeaheadCleared);

        // Also put the typeheads in an object to avoid having to make ternaries to get the right
        // one in functions that take a 'key' argument
        typeaheads = {
            origin: typeaheadFrom,
            destination: typeaheadTo
        };

        $(options.selectors.reverseButton).click($.proxy(reverseOriginDestination, this));

        setFromUserPreferences();
    }

    // Load origin and destination from user preferences and prefill the form if they're set
    function setFromUserPreferences() {
        var origin = UserPreferences.getPreference('origin');
        var destination = UserPreferences.getPreference('destination');

        if (origin && origin.location) {
            typeaheadFrom.setValue(UserPreferences.getPreference('originText'));
        }

        if (destination && destination.location) {
            typeaheadTo.setValue(UserPreferences.getPreference('destinationText'));
        }
    }

    // Handle the form-related parts of a typeahead select, then fire an event with the new
    // location for the directions and explore controllers to use
    function onTypeaheadSelected(event, key, location) {
        if (!location) {
            UserPreferences.clearLocation(key);
        } else {
            UserPreferences.setLocation(key, location);
        }

        events.trigger(eventNames.selected, [key, location]);
    }

    // For setting origin or destination from code, e.g. directions links
    function setLocation(key, location) {
        typeaheads[key].setValue(location.address);
        UserPreferences.setLocation(key, location);
        events.trigger(eventNames.selected, [key, location]);
    }

    function onTypeaheadCleared(event, key) {
        UserPreferences.clearLocation(key);
        events.trigger(eventNames.cleared, key);
    }

    // Swap origin and destination in the typeahead and in UserPerferences, then trigger an event
    // with the new values.
    function reverseOriginDestination() {
        // read what they are now
        var origin = UserPreferences.getPreference('origin');
        var originText = UserPreferences.getPreference('originText');
        var destination = UserPreferences.getPreference('destination');
        var destinationText = UserPreferences.getPreference('destinationText');

        // update local storage
        UserPreferences.setPreference('origin', destination);
        UserPreferences.setPreference('originText', destinationText);
        UserPreferences.setPreference('destination', origin);
        UserPreferences.setPreference('destinationText', originText);

        // update the text control
        typeaheadFrom.setValue(destinationText);
        typeaheadTo.setValue(originText);

        // Trigger reversed event, with new origin and destination, for directions controller to use
        events.trigger(eventNames.reversed, [destination, origin]);
    }

    /**
     * Change the origin or destination based on a marker being dragged, reverse-geocode the
     * location, then emit 'selected' if successful or 'cleared' on error.
     *
     * @param {String} key Either 'origin' or 'destination'
     * @param {Object} position Has coordinates for new spot as 'lat' and 'lng' properties
     */
    function moveOriginDestination(key, position) {
        if (key !== 'origin' && key !== 'destination') {
            console.error('Unrecognized key in moveOriginDestination: ' + key);
            return;
        }
        var typeahead = typeaheads[key];

        Geocoder.reverse(position.lat, position.lng).then(function (data) {
            if (data && data.address) {
                // prevent typeahead dropdown from opening by removing focus
                $(options.selectors.typeaheadFrom).blur();
                $(options.selectors.typeaheadTo).blur();

                var location = Utils.convertReverseGeocodeToLocation(data);
                UserPreferences.setPreference(key, location);
                /*jshint camelcase: false */
                var fullAddress = data.address.Match_addr;
                /*jshint camelcase: true */
                UserPreferences.setPreference(key + 'Text', fullAddress);
                // The change event is triggered after setting the typeahead value
                // in order to run the navigation icon hide/show logic
                typeahead.setValue(fullAddress);
                events.trigger(eventNames.selected, [key, location]);
            } else {
                // unset location and show error
                UserPreferences.clearLocation(key);
                typeahead.setValue('');
                events.trigger(eventNames.geocodeError, key);
            }
        });
    }

    // Clear both fields and any errors
    function clearAll() {
        typeaheadFrom.setValue('');
        typeaheadTo.setValue('');
        $(options.selectors.origin).removeClass(options.selectors.errorClass);
        $(options.selectors.destination).removeClass(options.selectors.errorClass);
        $(options.selectors.alert).remove();
    }

    // Add the error class to the given field if it's not set in UserPreferences, or remove
    // the error class if it is.
    function setError(key) {
        var $input = $(options.selectors[key]);
        if (UserPreferences.getPreference(key)) {
            $input.removeClass(options.selectors.errorClass);
        } else {
            $input.addClass(options.selectors.errorClass);
        }
    }

})(jQuery, CAC.Search.Typeahead, CAC.Search.Geocoder, CAC.User.Preferences, CAC.Utils);
