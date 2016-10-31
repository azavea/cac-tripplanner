CAC.Pages.Home = (function ($, BikeModeOptions,  MapControl, Templates, UserPreferences) {
    'use strict';

    var defaults = {
        selectors: {
            // destinations
            placeCard: '.place-card',
            placeList: '.place-list',

            // directions form selectors
            directionsForm: '.directions-form-element',
            directionsFrom: '.directions-from',
            directionsTo: '.directions-to',

            // mode related selectors
            modeToggle: '.mode-toggle',
            modeOption: '.mode-option',
            onClass: 'on',
            offClass: 'off',
            selectedModes: '.mode-option.on',
            transitIconOnOffClasses: 'icon-transit-on icon-transit-off',
            transitModeOption: '.mode-option.transit',

            // typeahead
            typeaheadFrom: '#input-directions-from',
            typeaheadTo: '#input-directions-to',

            // top-level classes
            homePageClass: 'body-home',
            mapPageClasses: 'body-map body-has-sidebar-banner',

            // TODO: update or remove old selectors below
            directionsMode: '#directionsMode input',
            errorClass: 'error',
            exploreForm: '#explore',
            exploreMode: '#exploreMode input',
            exploreOrigin: '#exploreOrigin',
            exploreTime: '#exploreTime',
            submitErrorModal: '#submit-error-modal',
            toggleButton: '.toggle-search button',
            toggleDirectionsButton: '#toggle-directions',
            toggleExploreButton: '#toggle-explore',
            typeaheadExplore: '#exploreOrigin',
            viewAllDestinations: '#viewAllDestinations'
        }
    };
    var destinationSearchUrl = '/api/destinations/search';
    var options = {};
    var bikeModeOptions = null;
    var typeaheads = {};

    var mapControl = null;

    // TODO: rework tab control
    var sidebarTabControl = null;

    function Home(params) {
        options = $.extend({}, defaults, params);
        bikeModeOptions = new BikeModeOptions();
    }

    var submitDirections = function(event) {
        if (event) {
            event.preventDefault();
        }
        var mode = bikeModeOptions.getMode(options.selectors.selectedModes);

        var origin = UserPreferences.getPreference('originText');
        var destination = UserPreferences.getPreference('destinationText');

        if (!origin) {
            $(options.selectors.directionsFrom).addClass(options.selectors.errorClass);
        }

        if (!destination) {
            $(options.selectors.directionsTo).addClass(options.selectors.errorClass);
        }

        // check if either input is in error status
        if ($(options.selectors.directionsFrom).hasClass(options.selectors.errorClass) ||
            $(options.selectors.directionsTo).hasClass(options.selectors.errorClass)) {

            console.error('error! danger will robinson!');
            //$(options.selectors.submitErrorModal).modal();
            return;
        }

        if (origin && destination) {
            UserPreferences.setPreference('method', 'directions');
            UserPreferences.setPreference('mode', mode);

            // change to map view
            $('.' + options.selectors.homePageClass)
                .blur()
                .removeClass(options.selectors.homePageClass)
                .addClass(options.selectors.mapPageClasses);
        } else {
            //$(options.selectors.submitErrorModal).modal();
            console.error('missing origin or destination.');
        }
    };

    var submitExplore = function(event) {
        event.preventDefault();
        var exploreTime = $(options.selectors.exploreTime).val();
        var mode = bikeModeOptions.getMode(options.selectors.exploreMode);
        var origin = UserPreferences.getPreference('originText');

        if (!origin) {
            $(options.selectors.exploreOrigin).addClass(options.selectors.errorClass);
        }

        // check if the input is in error status
        if ($(options.selectors.exploreOrigin).hasClass(options.selectors.errorClass)) {
            $(options.selectors.submitErrorModal).modal();
            return;
        }

        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreTime);
        UserPreferences.setPreference('mode', mode);

        window.location = '/map';
    };

    var loadFromPreferences = function() {
        var method = UserPreferences.getPreference('method');
        var mode = UserPreferences.getPreference('mode');
        setTab(method);

        // 'explore' tab options
        var originText = UserPreferences.getPreference('originText');
        var exploreTime = UserPreferences.getPreference('exploreTime');

        typeaheads.typeaheadExplore.setValue(originText);
        $(options.selectors.exploreTime).val(exploreTime);
        bikeModeOptions.setMode(options.selectors.exploreMode, mode);

        // 'directions' tab options
        var destinationText = UserPreferences.getPreference('destinationText');
        typeaheads.typeaheadFrom.setValue(originText);

        typeaheads.typeaheadTo.setValue(destinationText);
        bikeModeOptions.setMode(options.selectors.directionsMode, mode);
    };

    Home.prototype.initialize = function () {

        // Map initialization logic and event binding
        // TODO: rework tab control
        sidebarTabControl = new CAC.Control.SidebarTab();

        mapControl = new MapControl({
            homepage: true,
            tabControl: sidebarTabControl
        });

        // handle mode toggle buttons
        $(options.selectors.modeToggle).on('click', options.selectors.modeOption, function(e) {
            $(this).toggleClass(options.selectors.onClass)
                .siblings(options.selectors.modeOption).toggleClass(options.selectors.onClass);
            e.preventDefault();
        });

        $(options.selectors.transitModeOption).on('click', function(e) {
            $(this).toggleClass(options.selectors.onClass + ' ' + options.selectors.offClass)
                .find('i').toggleClass(options.selectors.transitIconOnOffClasses);
            e.preventDefault();
        });

        // TODO: update below for redesign
        this.destinations = null;
        $(options.selectors.toggleButton).on('click', function(){
            var id = $(this).attr('id');
            setTab(id);
        });

        $.each(['Explore', 'From', 'To'], $.proxy(function(i, id) {
            var typeaheadName = 'typeahead' + id;
            var typeahead = new CAC.Search.Typeahead(options.selectors[typeaheadName]);
            typeahead.events.on(typeahead.eventNames.selected, $.proxy(onTypeaheadSelected, this));
            typeahead.events.on(typeahead.eventNames.cleared, $.proxy(onTypeaheadCleared, this));
            typeaheads[typeaheadName] = this[typeaheadName] = typeahead;
        }, this));

        // save form data and redirect to map when 'go' button clicked

        // TODO: redesign has form, but no way to submit. remove this?
        $(options.selectors.exploreForm).submit(submitExplore);
        $(options.selectors.directionsForm).submit(submitDirections);

        $(options.selectors.viewAllDestinations).click($.proxy(clickedViewAllDestinations, this));
        $(options.selectors.placeList).on('click',
                                          options.selectors.placeCard,
                                          $.proxy(clickedDestination, this));

        $(document).ready(loadFromPreferences);
    };

    return Home;

    function clickedViewAllDestinations(event) {
        event.preventDefault();

        // hide existing destinations list and show loading spinner
        $(options.selectors.placeList).addClass('hidden');
        $(options.selectors.destinationsSpinner).removeClass('hidden');

        var origin = UserPreferences.getPreference('origin');
        var payload = {
            'lat': origin.feature.geometry.y,
            'lon': origin.feature.geometry.x
        };

        $.ajax({
            type: 'GET',
            data: payload,
            cache: true,
            url: destinationSearchUrl,
            contentType: 'application/json'
        }).then(function(data) {
            if (data.destinations && data.destinations.length) {
                var html = Templates.destinations(data.destinations);
                $(options.selectors.placeList).html(html);

                // hide 'view all' button and spinner, and show features again
                $(options.selectors.viewAllDestinations).addClass('hidden');
                $(options.selectors.destinationsSpinner).addClass('hidden');
                $(options.selectors.placeList).removeClass('hidden');
            } else {
                $(options.selectors.destinationsSpinner).addClass('hidden');
                $(options.selectors.placeList).removeClass('hidden');
            }
        });
    }

    /**
     * When user clicks a destination, look it up, then redirect to its details in 'explore' tab.
     */
    function clickedDestination(event) {
        event.preventDefault();
        var mode = bikeModeOptions.getMode(options.selectors.exploreMode);
        var exploreTime = $(options.selectors.exploreTime).val();
        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreTime);
        UserPreferences.setPreference('mode', mode);

        var block = $(event.target).closest(options.selectors.placeCard);
        var placeId = block.data('destination-id');
        UserPreferences.setPreference('placeId', placeId);
        window.location = '/map';
    }

    function onTypeaheadCleared(event, key) {
        onTypeaheadSelected(event, key, undefined);
    }

    function onTypeaheadSelected(event, key, location) {
        event.preventDefault();  // do not submit form

        var $input;
        var $other;
        var prefKey;

        // Make sure to keep the directionsFrom origin in sync with the explore origin
        if (key === 'origin' || key === 'from') {
            prefKey = 'origin';
            $input = $(options.selectors[key === 'from' ? 'directionsFrom' : 'exploreOrigin']);
            $other = $(options.selectors[key === 'from' ? 'exploreOrigin' : 'directionsFrom']);

            var text = $input.typeahead('val');
            if (text !== $other.typeahead('val') && location) {
                if (key === 'from') {
                    typeaheads.typeaheadExplore.setValue(text);
                } else {
                    typeaheads.typeaheadFrom.setValue(text);
                }
            }
        } else if (key === 'to') {
            prefKey = 'destination';
            $input = $(options.selectors.typeaheadTo);
        } else {
            return;
        }

        if (location) {
            $input.removeClass(options.selectors.errorClass);
            UserPreferences.setPreference(prefKey, location);
            UserPreferences.setPreference(prefKey + 'Text', $input.typeahead('val'));

            submitDirections(event);
        } else {
            $input.addClass(options.selectors.errorClass);
            UserPreferences.setPreference(prefKey, undefined);
            UserPreferences.setPreference(prefKey + 'Text', '');
        }
    }

    function setTab(tab) {
        if (tab.indexOf('directions') > -1) {
            $(options.selectors.exploreForm).addClass('hidden');
            $(options.selectors.directionsForm).removeClass('hidden');
            $(options.selectors.toggleDirectionsButton).addClass('active');
            $(options.selectors.toggleExploreButton).removeClass('active');
        } else {
            $(options.selectors.directionsForm).addClass('hidden');
            $(options.selectors.exploreForm).removeClass('hidden');
            $(options.selectors.toggleDirectionsButton).removeClass('active');
            $(options.selectors.toggleExploreButton).addClass('active');
        }
    }

})(jQuery, CAC.Control.BikeModeOptions, CAC.Map.Control, CAC.Home.Templates, CAC.User.Preferences);
