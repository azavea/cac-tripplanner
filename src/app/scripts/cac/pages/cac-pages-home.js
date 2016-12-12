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

            homeLink: '.home-link',
            tabControl: '.tab-control',
            tabControlLink: '.nav-item',

            mapViewButton: '.map-view-btn',

            needWheelsBanner: '.sidebar-banner.indego-banner',
            sidebarBanner: '.sidebar-banner',
            sidebarBannerCloseButton: 'button.btn-dismiss-sidebar-banner',
            sidebarTripOptionsBanner: '.sidebar-banner.trip-options-banner',
            hiddenClass: 'hidden',

            originInput: '#input-directions-from'
        }
    };

    var options = {};
    var modeOptionsControl = null;
    var mapControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsFormControl = null;
    var directionsControl = null;
    var exploreControl = null;

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
        modeOptionsControl.setMode(UserPreferences.getPreference('mode'));

        directionsFormControl = new CAC.Control.DirectionsFormControl({});

        directionsControl = new CAC.Control.Directions({
            mapControl: mapControl,
            directionsFormControl: directionsFormControl,
            tabControl: tabControl,
            urlRouter: urlRouter
        });

        exploreControl = new CAC.Control.Explore({
            mapControl: mapControl,
            modeOptionsControl: modeOptionsControl,
            directionsFormControl: directionsFormControl,
            tabControl: tabControl,
            urlRouter: urlRouter
        });

        showHideNeedWheelsBanner();

        _setupEvents();
    };

    return Home;

    function _setupEvents() {
        $(options.selectors.optionsButton).on('click', function() {
            // initialize trip options modal with current mode selection
            new TripOptions({
                onClose: closedTripModal
            }).open();
        });

        $(options.selectors.placeList).on('click',
                                          options.selectors.placeCardDirectionsLink,
                                          $.proxy(clickedDestination, this));

        // Listen for origin/destination dragging events to forward to the DirectionsFormControl
        mapControl.events.on(mapControl.eventNames.originMoved,
                             $.proxy(moveOrigin, this));
        mapControl.events.on(mapControl.eventNames.destinationMoved,
                             $.proxy(moveDestination, this));

        mapControl.events.on(mapControl.eventNames.mapMoved, SearchParams.updateMapCenter);

        modeOptionsControl.events.on(modeOptionsControl.eventNames.toggle, toggledMode);

        directionsFormControl.events.on(directionsFormControl.eventNames.selected,
                                        $.proxy(onTypeaheadSelected, this));

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

        // listen to sidebar banner close button
        $(options.selectors.sidebarBannerCloseButton).on('click', function(e) {
            e.stopPropagation();
            $(options.selectors.needWheelsBanner).addClass(options.selectors.hiddenClass);
        });

        // listen to sidebar banner click
        $(options.selectors.sidebarBanner).on('click', function() {
            // go to options modal
            new TripOptions({
                onClose: closedTripModal
            }).open();

            // dismiss 'need wheels?' banner
            $(options.selectors.needWheelsBanner).addClass(options.selectors.hiddenClass);
        });

        $(options.selectors.tabControl).on('click', options.selectors.tabControlLink, function (event) {
            var tabId = $(this).data('tab-id');
            if (tabId) {
                event.preventDefault();
                event.stopPropagation();

                tabControl.setTab(tabId);
            }
        });

        $(options.selectors.mapViewButton).on('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            tabControl.setTab(tabControl.TABS.EXPLORE);
        });

        $(options.selectors.homeLink).on('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            // clear user set trip options on navigation back to home page
            clearUserSettings();

            tabControl.setTab(tabControl.TABS.HOME);

            $(options.selectors.originInput).focus();
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
        $(document).ready(loadInitialMethod);
    }

    function loadInitialMethod() {
        if (!UserPreferences.isDefault('method')) {
            var method = UserPreferences.getPreference('method');
            if (method === 'directions') {
                tabControl.setTab(tabControl.TABS.DIRECTIONS);
                directionsControl.setFromUserPreferences();
            } else if (method === 'explore') {
                tabControl.setTab(tabControl.TABS.EXPLORE);
                exploreControl.setFromUserPreferences();
            }
        }
    }

    /**
     * When user clicks a destination, look it up, then redirect to its details in 'explore' tab.
     */
    function clickedDestination(event) {
        event.preventDefault();
        var exploreTime = $(options.selectors.exploreTime).val();
        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreTime);

        var block = $(event.target).closest(options.selectors.placeCard);
        var placeId = block.data('destination-id');
        UserPreferences.setPreference('placeId', placeId);

        // TODO: Enable once explore view exists
        // tabControl.setTab(tabControl.TABS.EXPLORE);
    }

    function onTypeaheadSelected() {
        if (tabControl.isTabShowing(tabControl.TABS.HOME)) {
            var origin = UserPreferences.getPreference('origin');
            var destination = UserPreferences.getPreference('destination');

            if (origin && destination) {
                tabControl.setTab(tabControl.TABS.DIRECTIONS);
            }
        }
    }

    function moveOrigin(event, position) {
        event.preventDefault();
        directionsFormControl.moveOriginDestination('origin', position);
    }

    function moveDestination(event, position) {
        event.preventDefault();
        directionsFormControl.moveOriginDestination('destination', position);
    }

    /**
     * Updates mode user preference when mode button toggled and triggers trip re-query.
     *
     * Listen to toggles of the mode buttons for walk, bike, and transit;
     * receives OTP mode string for those options. If in bike mode, check
     * if bike rental option set, and update mode appropriately; this option
     * is controlled separately from the mode toggle buttons.
     */
    function toggledMode(event, mode) {
        if (mode.indexOf('BICYCLE') >= 0) {
            var bikeShare = UserPreferences.getPreference('bikeShare');
            if (bikeShare) {
                mode = mode.replace('BICYCLE', 'BICYCLE_RENT');
            }
        }
        UserPreferences.setPreference('mode', mode);
        directionsControl.setOptions();
        showHideNeedWheelsBanner();
    }

    function closedTripModal(event) {
        // update mode, then requery
        toggledMode(event, modeOptionsControl.getMode());
    }

    // Clear all parameters set by the user, restoring blank origin/destination and default options.
    // This combined with selecting the Home tab will fully reset the Directions and Explore
    // controllers.
    function clearUserSettings() {
        UserPreferences.clearSettings();
        directionsFormControl.clearAll();
        // reset mode control
        modeOptionsControl.setMode(UserPreferences.getPreference('mode'));
    }

    /**
     * Sets the HTML in the trip options sidebar banner, based on user preferences.
     */
    function updateTripOptionsBanner() {
        var source = [
            '<div class="banner-message">',
            '{{modeText}} &bull; ',
            '{{#if rideTypeOrAccessibility}}',
                '{{rideTypeOrAccessibility}} &bull; ',
            '{{/if}}',
            '{{timingText}}',
            '</div>'
        ].join('');

        var mode = UserPreferences.getPreference('mode');
        var bikeMode = mode.indexOf('BICYCLE') >= 0;
        var indego = bikeMode && mode.indexOf('BICYCLE_RENT') >= 0;
        var transit = mode.indexOf('TRANSIT') >= 0;

        var modeText = 'Walk';
        var rideTypeOrAccessibility = '';
        if (bikeMode) {
            if (indego) {
                modeText = 'Indego';
            } else {
                modeText = 'Bike';
            }

            var rideType = UserPreferences.getPreference('bikeTriangle');
            rideTypeOrAccessibility = rideType.charAt(0).toUpperCase() + rideType.slice(1) + ' ride';
        } else {
            var wheelchair = UserPreferences.getPreference('wheelchair');
            if (wheelchair) {
                rideTypeOrAccessibility = 'Wheelchair';
            }
        }

        if (transit) {
            modeText += ' + Transit';
        }

        var timingText = TripOptions.prototype.getTimingText() || 'Depart now';

        var template = Handlebars.compile(source);
        var html = template({
            modeText: modeText,
            rideTypeOrAccessibility: rideTypeOrAccessibility,
            timingText: timingText
        });

        var $banner = $(options.selectors.sidebarTripOptionsBanner);
        $banner.html(html);
        $banner.removeClass(options.selectors.hiddenClass);
    }

    /**
     * The 'need wheels?' sidebar banner should only display when trip options have
     * never been seen and currently in bicycle mode. Check on initial load and mdoe toggle.
     */
    function showHideNeedWheelsBanner() {
        if (UserPreferences.showNeedWheelsPrompt()) {
            $(options.selectors.needWheelsBanner).removeClass(options.selectors.hiddenClass);
            // hide trip options banner
            $(options.selectors.sidebarTripOptionsBanner).addClass(options.selectors.hiddenClass);
        } else {
            $(options.selectors.needWheelsBanner).addClass(options.selectors.hiddenClass);
            // show trip options instead
            updateTripOptionsBanner();
        }
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
