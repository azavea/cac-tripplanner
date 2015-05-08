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
            exploreForm: '#explore',
            exploreMode: '#exploreMode input',
            exploreOrigin: '#exploreOrigin',
            exploreTime: '#exploreTime',
            toggleButton: '.toggle-search button',
            toggleExploreButton: '#toggle-explore',
            toggleDirectionsButton: '#toggle-directions',
            typeahead: 'input.typeahead',
            viewAllArticles: '#viewAllArticles',
            viewAllDestinations: '#viewAllDestinations'
        }
    };
    var articleUrl = '/api/articles';
    var destinationSearchUrl = '/api/destinations/search';
    var options = {};
    var bikeModeOptions = null;

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

        this.typeahead = new CAC.Search.Typeahead(options.selectors.typeahead);
        this.typeahead.events.on(this.typeahead.eventNames.selected,
                                 $.proxy(onTypeaheadSelected, this));

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
        var fromText = $(options.selectors.directionsFrom).val();
        var toText = $(options.selectors.directionsTo).val();

        // unset stored origin/destination and use defaults, if not entered
        if (!fromText) {
            UserPreferences.setPreference('from', undefined);
        }

        if (!toText) {
            UserPreferences.setPreference('to', undefined);
        }

        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('fromText', fromText);
        UserPreferences.setPreference('toText', toText);

        window.location = '/map';
    };

    var submitExplore = function(event) {
        event.preventDefault();
        var exploreTime = $(options.selectors.exploreTime).val();
        var mode = bikeModeOptions.getMode(options.selectors.exploreMode);
        var originText = $(options.selectors.exploreOrigin).val();

        if (!originText) {
            // unset stored origin and use default, if none entered
            UserPreferences.setPreference('origin', undefined);
        }

        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreTime);
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('originText', originText);

        window.location = '/map';
    };

    var loadFromPreferences = function loadFromPreferences() {

        // only load preferences if they are set
        if (!UserPreferences.havePreferences()) {
            return;
        }

        var method = UserPreferences.getPreference('method');
        var mode = UserPreferences.getPreference('mode');
        setTab(method);

        // 'explore' tab options
        var originText = UserPreferences.getPreference('originText');
        var exploreTime = UserPreferences.getPreference('exploreTime');

        $(options.selectors.exploreOrigin).typeahead('val', originText);
        $(options.selectors.exploreTime).val(exploreTime);
        bikeModeOptions.setMode(options.selectors.exploreMode, mode);

        // 'directions' tab options
        var fromText = UserPreferences.getPreference('fromText');
        var toText = UserPreferences.getPreference('toText');
        $(options.selectors.directionsFrom).typeahead('val', fromText);
        $(options.selectors.directionsTo).typeahead('val', toText);
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
                UserPreferences.setPreference('originText', addr);
                // show isochrone around destination
                UserPreferences.setPreference('origin', destination);
                UserPreferences.setPreference('method', 'explore');
                UserPreferences.setPreference('exploreTime', exploreTime);
                UserPreferences.setPreference('mode', mode);
                window.location = '/map';
            } else {
                console.error('Could not find destination ' + destName);
            }
        });
    }

    function onTypeaheadSelected(event, key, location) {
        event.preventDefault();  // do not submit form
        UserPreferences.setPreference(key, location);
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
