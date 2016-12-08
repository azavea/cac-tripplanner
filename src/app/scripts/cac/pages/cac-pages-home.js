CAC.Pages.Home = (function ($, ModeOptions,  MapControl, TripOptions, SearchParams, TabControl,
                            Templates, UserPreferences, UrlRouter) {
    'use strict';

    var defaults = {
        selectors: {
            // modal
            optionsButton: '.btn-options',

            // destinations
            placeCard: '.place-card',
            placeCardDirectionsLink: '.place-card .place-action-go',
            placeList: '.place-list',

            map: '.the-map',

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

            homeLink: '.home-link',
            tabControl: '.tab-control',
            tabControlLink: '.nav-item'
        }
    };

    var options = {};
    var modeOptionsControl = null;
    var mapControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsControl = null;

    function Home(params) {
        options = $.extend({}, defaults, params);
    }

    /* TODO: update for redesign or remove
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
    */

    Home.prototype.initialize = function () {
        urlRouter = new UrlRouter();

        tabControl = new TabControl({
            router: urlRouter
        });

        mapControl = new MapControl({
            tabControl: tabControl
        });

        modeOptionsControl = new ModeOptions();

        directionsControl = new CAC.Control.Directions({
            mapControl: mapControl,
            modeOptionsControl: modeOptionsControl,
            tabControl: tabControl,
            urlRouter: urlRouter
        });

        _setupEvents();
    };

    return Home;

    function _setupEvents() {
        $(options.selectors.optionsButton).on('click', function() {
            // initialize trip options modal with current mode selection
            new TripOptions({
                currentMode: modeOptionsControl.getMode(),
                onClose: directionsControl.setOptions
            }).open();
        });

        $(options.selectors.placeList).on('click',
                                          options.selectors.placeCardDirectionsLink,
                                          $.proxy(clickedDestination, this));

        mapControl.events.on(mapControl.eventNames.originMoved,
                             $.proxy(moveOrigin, this));

        mapControl.events.on(mapControl.eventNames.destinationMoved,
                             $.proxy(moveDestination, this));

        mapControl.events.on(mapControl.eventNames.mapMoved, SearchParams.updateMapCenter);


        if ($(options.selectors.map).is(':visible')) {
            // Map is visible on load
            mapControl.loadMap.apply(mapControl, null);
        } else {
            // Listen to window resize on mobile view; if map becomes visible, load tiles.
            $(window).resize(function() {
                if ($(options.selectors.map).is(':visible')) {
                    if (!mapControl.isLoaded()) {
                        mapControl.loadMap.apply(mapControl, null);
                    }

                    // done listening to resizes after map loads
                    $(window).off('resize');
                }
            });
        }

        $(options.selectors.tabControl).on('click', options.selectors.tabControlLink, function (event) {
            var tabId = $(this).data('tab-id');
            if (tabId === tabControl.TABS.EXPLORE) {
                event.preventDefault();
                event.stopPropagation();

                tabControl.setTab(tabControl.TABS.EXPLORE);
            }
        });
        $(options.selectors.homeLink).on('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            tabControl.setTab(tabControl.TABS.HOME);
        });

        // disable zoom on mobile safari
        if (isMobileSafari()) {
            $(document).bind('touchstart', function(e) {
                if (e.touches.length > 1) {
                    e.preventDefault(); // pinch - prevent zoom
                    e.stopPropagation();
                    return;
                }

                var t2 = e.timeStamp;
                var t1 = this.lastTouch || t2;
                var dt = t2 - t1;
                this.lastTouch = t2;

                if (dt && dt < 500) {
                    e.preventDefault(); // double tap - prevent zoom
                    e.stopPropagation();
                }
            });
        }

        // load directions if origin and destination set
        $(document).ready(directionsControl.setFromUserPreferences());
    }

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

        // TODO: Enable once explore view exists
        // tabControl.setTab(tabControl.TABS.EXPLORE);
    }

    function moveOrigin(event, position) {
        event.preventDefault();
        directionsControl.moveOriginDestination('origin', position);
    }

    function moveDestination(event, position) {
        event.preventDefault();
        directionsControl.moveOriginDestination('destination', position);
    }

    /**
     * Helper to check user agent string to see if on Mobile Safari browser
     *
     @returns {boolean} True if visiting from Mobile Safari
     */
    function isMobileSafari() {
        var ua = window.navigator.userAgent;
        console.log(ua);
        var iOS = /iP(ad|hone)/i.test(ua); // iPad / iPhone
        var webkit = /WebKit/i.test(ua);
        // Chrome and Opera also report WebKit
        return iOS && webkit && !(/CriOS/i.test(ua)) && !(/OPiOS/i.test(ua));
    }

})(jQuery, CAC.Control.ModeOptions, CAC.Map.Control, CAC.Control.TripOptions, CAC.Search.SearchParams,
    CAC.Control.Tab, CAC.Home.Templates, CAC.User.Preferences, CAC.UrlRouting.UrlRouter);
