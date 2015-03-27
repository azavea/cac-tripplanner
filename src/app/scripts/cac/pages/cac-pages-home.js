CAC.Pages.Home = (function ($, Templates, UserPreferences) {
    'use strict';

    var defaults = {
        selectors: {
            destinationAddress: '.destination-address',
            destinationAddressLineTwo: '.destination-address-2',
            destinationName: '.destination-name',
            destinationBlock: '.block-destination',
            destinationsContainer: '.destinations',
            directionsForm: '#directions',
            directionsFrom: '#directionsFrom',
            directionsMode: '#directionsMode',
            directionsTo: '#directionsTo',
            exploreForm: '#explore',
            exploreMode: '#exploreMode',
            exploreOrigin: '#exploreOrigin',
            exploreTime: '#exploreTime',
            spinner: '.sk-spinner',
            toggleButton: '.toggle-search button',
            toggleExploreButton: '#toggle-explore',
            toggleDirectionsButton: '#toggle-directions',
            typeahead: 'input.typeahead',
            viewAll: '#viewAll'
        }
    };
    var destinationSearchUrl = '/api/destinations/search';
    var options = {};

    function Home(params) {
        options = $.extend({}, defaults, params);
    }

    Home.prototype.initialize = function () {
        this.destinations = null;
        $(options.selectors.toggleButton).on('click', function(){
            var id = $(this).attr('id');
            setTab(id);
        });

        this.typeahead = new CAC.Search.Typeahead(options.selectors.typeahead);
        this.typeahead.events.on('cac:typeahead:selected', $.proxy(onTypeaheadSelected, this));

        // save form data and redirect to map when 'go' button clicked
        $(options.selectors.exploreForm).submit(submitExplore);
        $(options.selectors.directionsForm).submit(submitDirections);

        $(options.selectors.viewAll).click($.proxy(clickedViewAll, this));
        $(options.selectors.destinationBlock).click($.proxy(clickedDestination, this));

        $(document).ready(loadFromPreferences);
    };

    var submitDirections = function(event) {
        event.preventDefault();
        var mode = $(options.selectors.directionsMode).val();
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
        var mode = $(options.selectors.exploreMode).val();
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
        $(options.selectors.exploreMode).val(mode);

        // 'directions' tab options
        var fromText = UserPreferences.getPreference('fromText');
        var toText = UserPreferences.getPreference('toText');
        $(options.selectors.directionsFrom).typeahead('val', fromText);
        $(options.selectors.directionsTo).typeahead('val', toText);
        $(options.selectors.directionsMode).val(mode);
    };

    return Home;

    function clickedViewAll() {
        event.preventDefault();

        // hide existing destinations list and show loading spinner
        $(options.selectors.destinationsContainer).addClass('hidden');
        $(options.selectors.spinner).removeClass('hidden');

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
                $(options.selectors.viewAll).addClass('hidden');
                $(options.selectors.spinner).addClass('hidden');
                $(options.selectors.destinationsContainer).removeClass('hidden');
            } else {
                console.error('Could not load all destinations');
                $(options.selectors.spinner).addClass('hidden');
                $(options.selectors.destinationsContainer).removeClass('hidden');
            }
        });
    }

    /**
     * When user clicks a destination, look it up, then redirect to show directions to it on map.
     */
    function clickedDestination(event) {
        event.preventDefault();
        var block = $(event.target).closest(options.selectors.destinationBlock);
        var destName = block.children(options.selectors.destinationName).text();
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
                UserPreferences.setPreference('toText', addr);
                UserPreferences.setPreference('to', convertDestinationToFeature(destination));
                UserPreferences.setPreference('method', 'directions');
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

    /**
     * Convert destination from search endpoint into a feature formatted like typeahead results.
     * TODO: Featured destinations should probably be in the typeahead, and this function
     * moved or removed.
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

})(jQuery, CAC.Home.Templates, CAC.User.Preferences);
