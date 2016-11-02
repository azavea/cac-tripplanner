CAC.Pages.Home = (function ($, ModeOptions,  MapControl, Templates, UserPreferences,
                            UrlRouter) {
    'use strict';

    var defaults = {
        selectors: {
            // destinations
            placeCard: '.place-card',
            placeCardDirectionsLink: '.place-card .place-action-go',
            placeList: '.place-list',

            // directions form selectors
            directionsForm: '.directions-form-element',
            directionsFrom: '.directions-from',
            directionsTo: '.directions-to',

            // typeahead
            typeaheadFrom: '#input-directions-from',
            typeaheadTo: '#input-directions-to',

            // top-level classes
            homePageClass: 'body-home',
            mapPageClasses: 'body-map body-has-sidebar-banner',

            // TODO: update or remove old selectors below
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
        }
    };

    var options = {};
    var modeOptionsControl = null;
    var typeaheads = {};

    var mapControl = null;
    var urlRouter = null;
    var directionsControl = null;

    // TODO: rework tab control
    var sidebarTabControl = null;

    function Home(params) {
        options = $.extend({}, defaults, params);
        modeOptionsControl = new ModeOptions();
    }

    var submitDirections = function(event) {
        if (event) {
            event.preventDefault();
        }
        var mode = modeOptionsControl.getMode();

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

            // TODO: update or remove error modals
            console.error('error with origin or destination');
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
            // TODO: update or remove error modals
            //$(options.selectors.submitErrorModal).modal();
            console.error('missing origin or destination.');
        }
    };

    var submitExplore = function(event) {
        event.preventDefault();
        var exploreTime = $(options.selectors.exploreTime).val();
        var mode = modeOptionsControl.getMode();
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

        // TODO: update for 'explore' mode
        // 'explore' tab options
        var originText = UserPreferences.getPreference('originText');
        var exploreTime = UserPreferences.getPreference('exploreTime');

        typeaheads.typeaheadExplore.setValue(originText);
        $(options.selectors.exploreTime).val(exploreTime);
        //modeOptionsControl.setMode(options.selectors.exploreMode, mode);

        // 'directions' tab options
        var destinationText = UserPreferences.getPreference('destinationText');
        typeaheads.typeaheadFrom.setValue(originText);

        typeaheads.typeaheadTo.setValue(destinationText);
        modeOptionsControl.setMode(mode);
    };

    Home.prototype.initialize = function () {
        urlRouter = new UrlRouter();

        // Map initialization logic and event binding
        // TODO: rework tab control
        sidebarTabControl = new CAC.Control.SidebarTab();

        mapControl = new MapControl({
            homepage: true,
            tabControl: sidebarTabControl
        });

        directionsControl = new CAC.Control.Directions({
            mapControl: mapControl,
            modeOptionsControl: modeOptionsControl,
            tabControl: sidebarTabControl,
            urlRouter: urlRouter
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

        $(options.selectors.placeList).on('click',
                                          options.selectors.placeCardDirectionsLink,
                                          $.proxy(clickedDestination, this));

        $(document).ready(loadFromPreferences);
    };

    return Home;

    /**
     * When user clicks a destination, look it up, then redirect to its details in 'explore' tab.
     */
    function clickedDestination(event) {
        event.preventDefault();
        var mode = modeOptionsControl.getMode();
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

})(jQuery, CAC.Control.ModeOptions, CAC.Map.Control, CAC.Home.Templates, CAC.User.Preferences,
    CAC.UrlRouting.UrlRouter);
