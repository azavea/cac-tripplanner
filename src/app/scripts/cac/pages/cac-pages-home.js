CAC.Pages.Home = (function ($, BikeModeOptions, Templates, UserPreferences) {
    'use strict';

    var defaults = {
        selectors: {
            articlesContainer: '.articles',
            articlesSpinner: '#articlesSpinner',
            destinationAddress: '.destination-address',
            destinationAddressLineTwo: '.destination-address-2',
            destinationName: '.destination-name',
            destinationBlock: '.block-destination',
            destinationsContainer: '.destinations',
            destinationsSpinner: '#destinationsSpinner',
            directionsForm: '#directions',
            directionsFrom: '#directionsFrom',
            directionsMode: '#directionsMode input',
            directionsTo: '#directionsTo',
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
            typeaheadFrom: '#directionsFrom',
            typeaheadTo: '#directionsTo',
            viewAllArticles: '#viewAllArticles',
            viewAllDestinations: '#viewAllDestinations'
        }
    };
    var articleUrl = '/api/articles';
    var destinationSearchUrl = '/api/destinations/search';
    var options = {};
    var bikeModeOptions = null;
    var typeaheads = {};

    function Home(params) {
        options = $.extend({}, defaults, params);
        bikeModeOptions = new BikeModeOptions();
    }

    Home.prototype.initialize = function () {
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
        $(options.selectors.exploreForm).submit(submitExplore);
        $(options.selectors.directionsForm).submit(submitDirections);

        $(options.selectors.viewAllArticles).click($.proxy(clickedViewAllArticles, this));
        $(options.selectors.viewAllDestinations).click($.proxy(clickedViewAllDestinations, this));
        $(options.selectors.destinationBlock).click($.proxy(clickedDestination, this));

        $(document).ready(loadFromPreferences);
    };

    var submitDirections = function(event) {
        event.preventDefault();
        var mode = bikeModeOptions.getMode(options.selectors.directionsMode);
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

            $(options.selectors.submitErrorModal).modal();
            return;
        }

        if (origin && destination) {
            UserPreferences.setPreference('method', 'directions');
            UserPreferences.setPreference('mode', mode);
            window.location = '/map';
        } else {
            $(options.selectors.submitErrorModal).modal();
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

    return Home;

    function clickedViewAllArticles(event) {
        event.preventDefault();

        // hide existing articles and show loading spinner
        $(options.selectors.articlesContainer).addClass('hidden');
        $(options.selectors.articlesSpinner).removeClass('hidden');

        $.ajax({
            type: 'GET',
            cache: true,
            url: articleUrl,
            contentType: 'application/json'
        }).then(function(data) {
            if (data && data.length) {
                var html = Templates.articles(data);
                $(options.selectors.articlesContainer).html(html);

                // hide 'view all' button and spinner, and show features again
                $(options.selectors.viewAllArticles).addClass('hidden');
                $(options.selectors.articlesSpinner).addClass('hidden');
                $(options.selectors.articlesContainer).removeClass('hidden');
            } else {
                $(options.selectors.articlesSpinner).addClass('hidden');
                $(options.selectors.articlesContainer).removeClass('hidden');
            }
        });
    }

    function clickedViewAllDestinations(event) {
        event.preventDefault();

        // hide existing destinations list and show loading spinner
        $(options.selectors.destinationsContainer).addClass('hidden');
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
                $(options.selectors.destinationsContainer).html(html);

                // set click event on added features
                $(options.selectors.destinationBlock).click($.proxy(clickedDestination, this));

                // hide 'view all' button and spinner, and show features again
                $(options.selectors.viewAllDestinations).addClass('hidden');
                $(options.selectors.destinationsSpinner).addClass('hidden');
                $(options.selectors.destinationsContainer).removeClass('hidden');
            } else {
                $(options.selectors.destinationsSpinner).addClass('hidden');
                $(options.selectors.destinationsContainer).removeClass('hidden');
            }
        });
    }

    /**
     * When user clicks a destination, look it up, then redirect to its details in 'explore' tab.
     */
    function clickedDestination(event) {
        event.preventDefault();
        var block = $(event.target).closest(options.selectors.destinationBlock);
        var destName = block.children(options.selectors.destinationName).text();
        var mode = bikeModeOptions.getMode(options.selectors.exploreMode);
        var exploreTime = $(options.selectors.exploreTime).val();
        var addr = [destName + ',',
                    block.children(options.selectors.destinationAddress).text(),
                    block.children(options.selectors.destinationAddressLineTwo).text()
                    ].join(' ');
        var payload = { 'text': destName };

        $.ajax({
            type: 'GET',
            data: payload,
            cache: true,
            url: destinationSearchUrl,
            contentType: 'application/json'
        }).then(function(data) {
            if (data.destinations && data.destinations.length) {
                var destination = data.destinations[0];
                UserPreferences.setPreference('destinationText', addr);
                UserPreferences.setPreference('destination', destination);
                UserPreferences.setPreference('method', 'explore');
                UserPreferences.setPreference('exploreTime', exploreTime);
                UserPreferences.setPreference('mode', mode);
                window.location = '/map';
            } else {
                console.error('Could not find destination ' + destName);
            }
        });
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
            $input = $(options.selectors.directionsTo);
        } else {
            return;
        }

        if (location) {
            $input.removeClass(options.selectors.errorClass);
            UserPreferences.setPreference(prefKey, location);
            UserPreferences.setPreference(prefKey + 'Text', $input.typeahead('val'));
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

})(jQuery, CAC.Control.BikeModeOptions, CAC.Home.Templates, CAC.User.Preferences);
