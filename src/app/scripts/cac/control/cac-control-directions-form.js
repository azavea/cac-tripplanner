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
            typeaheadText: 'input.tt-input',

            // used for error display
            origin: '.directions-from.directions-text-input',
            destination: '.directions-to.directions-text-input',
            directionsTextInput: '.directions-text-input',
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
        clearFocus: clearFocus,
        clearAll: clearAll,
        setLocation: setLocation,
        setStoredLocation: setStoredLocation,
        setError: setError,
        setFromUserPreferences: setFromUserPreferences
    };

    return DirectionsFormControl;

    function initialize() {
        typeaheads.destination = new Typeahead(options.selectors.typeaheadTo);
        typeaheads.destination.events.on(typeaheads.destination.eventNames.selected,
                                         onTypeaheadSelected);
        typeaheads.destination.events.on(typeaheads.destination.eventNames.cleared,
                                         onTypeaheadCleared);

        typeaheads.origin = new Typeahead(options.selectors.typeaheadFrom);
        typeaheads.origin.events.on(typeaheads.origin.eventNames.selected, onTypeaheadSelected);
        typeaheads.origin.events.on(typeaheads.origin.eventNames.cleared, onTypeaheadCleared);

        $(options.selectors.reverseButton).click($.proxy(reverseOriginDestination, this));

        // remove input error class when input receives focus
        $(options.selectors.typeaheadText).focus(function(event) {
            $(event.target)
                .closest(options.selectors.directionsTextInput)
                .removeClass(options.selectors.errorClass);
        });

        setFromUserPreferences();
    }

    // Load origin and destination from user preferences and prefill the form if they're set
    function setFromUserPreferences() {
        var origin = UserPreferences.getPreference('origin');
        var destination = UserPreferences.getPreference('destination');

        if (origin && origin.location) {
            typeaheads.origin.setValue(UserPreferences.getPreference('originText'));
        } else {
            typeaheads.origin.setValue('');
        }

        if (destination && destination.location) {
            typeaheads.destination.setValue(UserPreferences.getPreference('destinationText'));
        } else {
            typeaheads.destination.setValue('');
        }
    }

    // Handle the form-related parts of a typeahead select, then fire an event with the new
    // location for the directions and explore controllers to use
    function onTypeaheadSelected(event, key, location) {
        if (!location) {
            UserPreferences.clearLocation(key);
        } else {
            UserPreferences.setLocation(key, location);

            if (key === 'origin') {
                // shift focus to destination after origin selected
                $(options.selectors.typeaheadTo).focus();
            }
        }

        events.trigger(eventNames.selected, [key, location]);
    }

    // Set the origin or destination without triggering trip recalculation
    function setStoredLocation(key, location) {
        if (location) {
            typeaheads[key].setValue(location.address);
            UserPreferences.setLocation(key, location);
        } else {
            typeaheads[key].setValue('');
            UserPreferences.clearLocation(key);
        }
    }

    // For setting origin or destination from code, e.g. directions links
    function setLocation(key, location) {
        setStoredLocation(key, location);
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
        typeaheads.origin.setValue(destinationText);
        typeaheads.destination.setValue(originText);

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
                clearFocus();

                // use the exact location marker is at, rather than reverse geocode location
                data.location.x = position.lng;
                data.location.y = position.lat;

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

    function clearFocus() {
        $(options.selectors.typeaheadFrom).blur();
        $(options.selectors.typeaheadTo).blur();
    }

    // Clear both fields and any errors
    function clearAll() {
        typeaheads.origin.setValue('');
        typeaheads.destination.setValue('');
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
        } else if ($input.find(options.selectors.typeaheadText).val().length > 0) {
            $input.addClass(options.selectors.errorClass);
        }
    }

})(jQuery, CAC.Search.Typeahead, CAC.Search.Geocoder, CAC.User.Preferences, CAC.Utils);
