CAC.Pages.Home = (function ($, FilterOptions, ModeOptions,  MapControl, TripOptions, SearchParams,
                            TabControl, UserPreferences, UrlRouter, Utils) {
    'use strict';

    // this needs to match the value in styles/utils/_breakpoints.scss
    var XXS_BREAKPOINT = 480;

    var defaults = {
        selectors: {
            // modal
            optionsButton: '.btn-options',

            // destinations
            placeCard: '.place-card',
            placeCardDirectionsLink: '.place-card .place-action-go',
            placeCardName: '.place-card-name',
            placeList: '.place-list',
            places: '.places',

            map: '.the-map',

            homeLink: '.home-link',
            tabControl: '.tab-control',
            tabControlLink: '.nav-item',
            tabToToggleLink: '.directions-tab-button label',

            mapViewButton: 'a.map-view-btn',

            mapContainer: '.body-map',
            sidebarBanner: '.sidebar-banner',
            sidebarBannerCloseButton: 'button.btn-dismiss-sidebar-banner',
            needWheelsBanner: '.sidebar-banner.indego-banner',
            sidebarTripOptionsBanner: '.sidebar-banner.trip-options-banner',
            sidebarBannerClass: 'body-has-sidebar-banner',
            hiddenClass: 'hidden',

            originInput: '#input-directions-from'
        }
    };

    var options = {};
    var filterOptionsControl = null;
    var modeOptionsControl = null;
    var mapControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsFormControl = null;
    var directionsControl = null;
    var exploreControl = null;
    var tripOptionsTemplate = null;

    function Home(params) {
        options = $.extend({}, defaults, params);
    }

    Home.prototype.initialize = function () {
        urlRouter = new UrlRouter();

        tabControl = new TabControl({
            router: urlRouter
        });

        mapControl = new MapControl({
            tabControl: tabControl,
            isMobile: $(window).width() < XXS_BREAKPOINT
        });

        modeOptionsControl = new ModeOptions();
        modeOptionsControl.setMode(UserPreferences.getPreference('mode'));

        directionsFormControl = new CAC.Control.DirectionsFormControl({});

        exploreControl = new CAC.Control.Explore({
            mapControl: mapControl,
            directionsFormControl: directionsFormControl,
            tabControl: tabControl,
            urlRouter: urlRouter
        });

        directionsControl = new CAC.Control.Directions({
            mapControl: mapControl,
            directionsFormControl: directionsFormControl,
            exploreControl: exploreControl,
            tabControl: tabControl,
            urlRouter: urlRouter
        });

        // Precompile trip options template. Do before `showHideNeedWheelsBanner` called.
        var tripOptions = [
            '<div class="banner-message">',
            '{{modeText}}&ensp;&middot;&ensp;',
            '{{#if rideTypeOrAccessibility}}',
                '{{rideTypeOrAccessibility}}&ensp;&middot;&ensp;',
            '{{/if}}',
            '{{timingText}}',
            '</div>'
        ].join('');
        tripOptionsTemplate = Handlebars.compile(tripOptions);

        Utils.initializeMoment();
        showHideNeedWheelsBanner();
        _setupFilterControl();
        _setupEvents();
        setupServiceWorker();
    };

    return Home;

    function _setupEvents() {
        $(options.selectors.optionsButton).on('click', function() {
            // initialize trip options modal with current mode selection
            new TripOptions({
                onClose: closedTripModal
            }).open();
        });

        // Listen for origin/destination dragging events to forward to the DirectionsFormControl
        mapControl.events.on(mapControl.eventNames.originMoved,
                             $.proxy(moveOrigin, this));
        mapControl.events.on(mapControl.eventNames.destinationMoved,
                             $.proxy(moveDestination, this));

        mapControl.events.on(mapControl.eventNames.mapMoved, SearchParams.updateMapCenter);

        mapControl.events.on(mapControl.eventNames.destinationPopupClick,
                             $.proxy(clickedDestinationDirectionsPopup, this));

        tabControl.events.on(tabControl.eventNames.tabShown, onTabShown);

        modeOptionsControl.events.on(modeOptionsControl.eventNames.toggle, toggledMode);

        directionsFormControl.events.on(directionsFormControl.eventNames.selected,
                                        $.proxy(onTypeaheadSelected, this));

        urlRouter.events.on(urlRouter.eventNames.changed, onUrlChanged);

        // re-initialize filter control after templated HTML rewritten
        exploreControl.events.on(exploreControl.eventNames.destinationsLoaded,
                                 _setupFilterControl);

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
            hideNeedWheelsBanner();
        });

        // listen to sidebar banner click
        $(options.selectors.sidebarBanner).on('click', function() {
            // go to options modal
            new TripOptions({
                onClose: closedTripModal
            }).open();

            // dismiss 'need wheels?' banner
            hideNeedWheelsBanner();
        });

        $(options.selectors.tabControl).on('click', options.selectors.tabControlLink, function (event) {
            var tabId = $(this).data('tab-id');
            if (tabId) {
                event.preventDefault();
                event.stopPropagation();

                tabControl.setTab(tabId);
            }
        });

        // toggle from home or directions to explore, or explore to directions, using 'to' label
        $(options.selectors.tabToToggleLink).on('click', function () {

            // only allow explore mode on desktop and only respond to label in map view
            if (tabControl.isTabShowing(tabControl.TABS.HOME) ||
                $(window).width() < XXS_BREAKPOINT) {

                return;
            }

            if (tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
                tabControl.setTab(tabControl.TABS.DIRECTIONS);
            } else {
                tabControl.setTab(tabControl.TABS.EXPLORE);
            }
        });

        $(options.selectors.places).on('click', options.selectors.mapViewButton, function (event) {
            event.preventDefault();
            event.stopPropagation();
            $.proxy(tabControl.setTab(tabControl.TABS.EXPLORE), this);
        });

        $(options.selectors.places).on({
            click: onPlaceClicked,
            mouseenter: onPlaceHovered,
            mouseleave: onPlaceBlurred
        }, options.selectors.placeCard);

        $(options.selectors.places).on('click', options.selectors.placeCardDirectionsLink,
                                       $.proxy(clickedDestinationDirections, this));

        $(options.selectors.homeLink).on('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

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

        // Set active tab based on 'method'
        $(document).ready(setActiveTab);
    }

    // Destinations filter is templated with the destinations list, so must be
    // re-initialized after destinations list changes. Initialize it with this method.
    function _setupFilterControl() {
        if (filterOptionsControl) {
            filterOptionsControl.events.off();
            filterOptionsControl.destroy();
        }
        filterOptionsControl = new FilterOptions();
        filterOptionsControl.setFilter(UserPreferences.getPreference('destinationFilter'));
        filterOptionsControl.events.on(filterOptionsControl.eventNames.toggle, toggledFilter);
    }

    // Sets the active tab based on the 'method' user preference. The controllers listen for the
    // resulting "tab shown" event and do their thing if they're being activated (or hidden).
    function setActiveTab() {
        if (!UserPreferences.isDefault('method')) {
            var method = UserPreferences.getPreference('method');
            if (method === 'directions') {
                directionsControl.setFromUserPreferences();
                tabControl.setTab(tabControl.TABS.DIRECTIONS);
            } else if (method === 'explore') {
                exploreControl.showSpinner();
                exploreControl.setFromUserPreferences();
                tabControl.setTab(tabControl.TABS.EXPLORE);
                exploreControl.clickedExplore();
            }
        } else {
            tabControl.setTab(tabControl.TABS.HOME);
        }
    }

    function onTabShown(event, tabId) {
        // Returning to the Home tab resets everything as though it were loaded fresh
        if (tabId === tabControl.TABS.HOME) {
            UserPreferences.setPreference('method', undefined);
            clearUserSettings();
        }
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
     * Updates destination filter when filter selection changed.
     */
     function toggledFilter(event, filter) {
        // Do not trigger destination list requery unless filter actually changed.
        // Avoids possible infinite update loop with map page select control.
        var currentFilter = UserPreferences.getPreference('destinationFilter');
        if (currentFilter === filter) {
            return;
        }
        UserPreferences.setPreference('destinationFilter', filter);
        exploreControl.getNearbyPlaces();
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

                if (mode.indexOf('BICYCLE' > -1)) {
                    // always depart now in bike share mode
                    UserPreferences.setPreference('arriveBy', false);
                    UserPreferences.setPreference('dateTime', undefined);
                }
            }
        }
        UserPreferences.setPreference('mode', mode);
        directionsControl.setOptions();
        exploreControl.setOptions();
        showHideNeedWheelsBanner();
    }

    // Handler for changes to preferences due to URL change, i.e. browser back/forward
    // The URL router sends a signal and this triggers the appropriate update functions for
    // all the affected components.
    // Note that components are responsible for doing the right thing based on whether they're
    // active or not.
    function onUrlChanged() {
        filterOptionsControl.setFilter(UserPreferences.getPreference('destinationFilter'));
        modeOptionsControl.setMode(UserPreferences.getPreference('mode'));
        directionsFormControl.setFromUserPreferences();
        showHideNeedWheelsBanner();
        setActiveTab();
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
        // requery for place list once origin field cleared
        exploreControl.getNearbyPlaces();
    }

    function onPlaceClicked(event) {
        if (!mapControl || !mapControl.isochroneControl) {
            return;
        }
        var placeId = $(event.target).closest(options.selectors.placeCard).data('destination-id');
        mapControl.isochroneControl.highlightDestination(placeId, { panTo: true });
    }

    function onPlaceHovered(event) {
        if (!mapControl || !mapControl.isochroneControl) {
            return;
        }
        var placeId = $(event.target).closest(options.selectors.placeCard).data('destination-id');
        mapControl.isochroneControl.highlightDestination(placeId);
    }

    function onPlaceBlurred() {
        if (!mapControl || !mapControl.isochroneControl) {
            return;
        }
        mapControl.isochroneControl.highlightDestination(null);
    }

    /**
     * When user clicks the Directions link on a place card
     */
    function clickedDestinationDirections(event) {
        event.preventDefault();

        var placeCard = $(event.target).closest(options.selectors.placeCard);

        var destination = {
            id: placeCard.data('destination-id'),
            address: placeCard.find(options.selectors.placeCardName).text(),
            location: { x: placeCard.data('destination-x'), y: placeCard.data('destination-y') }
        };

        goToDestinationDirections(destination);
    }

    /**
     * When user clicks 'Get Directions' in a destination marker popup
     */
    function clickedDestinationDirectionsPopup(event, place) {
        // match the format expected
        place.location = {
            x: place.point.coordinates[0],
            y: place.point.coordinates[1]
        };
        goToDestinationDirections(place);
    }

    /**
     * Send user to the directions tab with place destination (whether or not there's an origin set)
     * @param {Object} destination Selected destination
     */
    function goToDestinationDirections(destination) {
        UserPreferences.setPreference('placeId', destination.id);
        directionsFormControl.setLocation('destination', destination);
        tabControl.setTab(tabControl.TABS.DIRECTIONS);
        if (!UserPreferences.getPreference('origin')) {
            directionsFormControl.setError('origin');
            $(options.selectors.originInput).focus();
        }
    }

    /**
     * Sets the HTML in the trip options sidebar banner, based on user preferences.
     */
    function updateTripOptionsBanner() {
        var isDefault = true;

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
            isDefault = UserPreferences.isDefault('bikeShare') && isDefault;

            var rideType = UserPreferences.getPreference('bikeTriangle');
            isDefault = UserPreferences.isDefault('bikeTriangle') && isDefault;
            rideTypeOrAccessibility = rideType.charAt(0).toUpperCase() + rideType.slice(1) + ' ride';
        } else {
            var wheelchair = UserPreferences.getPreference('wheelchair');
            isDefault = UserPreferences.isDefault('wheelchair') && isDefault;
            if (wheelchair) {
                rideTypeOrAccessibility = 'Wheelchair';
            }
        }

        if (transit) {
            modeText += ' + Transit';
        }

        var timingText = TripOptions.prototype.getTimingText() || 'Depart now';
        isDefault = TripOptions.prototype.getTimingText() === null && isDefault;

        var $banner = $(options.selectors.sidebarTripOptionsBanner);

        if (isDefault) {
            $banner.addClass(options.selectors.hiddenClass);
            $(options.selectors.mapContainer).removeClass(options.selectors.sidebarBannerClass);
            return;
        }

        var html = tripOptionsTemplate({
            modeText: modeText,
            rideTypeOrAccessibility: rideTypeOrAccessibility,
            timingText: timingText
        });

        $banner.html(html);
        $(options.selectors.mapContainer).addClass(options.selectors.sidebarBannerClass);
        $banner.removeClass(options.selectors.hiddenClass);
    }

    /**
     * The 'need wheels?' sidebar banner should only display when trip options have
     * never been seen and currently in bicycle mode. Check on initial load and mode toggle.
     */
    function showHideNeedWheelsBanner() {
        if (UserPreferences.showNeedWheelsPrompt()) {
            $(options.selectors.needWheelsBanner).removeClass(options.selectors.hiddenClass);
            // hide trip options banner
            $(options.selectors.sidebarTripOptionsBanner).addClass(options.selectors.hiddenClass);
            $(options.selectors.mapContainer).addClass(options.selectors.sidebarBannerClass);
        } else {
            hideNeedWheelsBanner();
        }
    }

    function hideNeedWheelsBanner() {
        $(options.selectors.needWheelsBanner).addClass(options.selectors.hiddenClass);
        // show trip options instead, if applicable
        updateTripOptionsBanner();
    }

    /**
     * Set up a service worker to make this a PWA app.
     * Necessary to support 'add to homescreen' with the app manifest.json.
     * Service worker is defined in Django template.
     */
    function setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('/service-worker.js').then(function() {
                    // success. worker scoped here to domain.
                }, function(err) {
                    // registration failed
                    console.error('ServiceWorker registration failed: ', err);
                });
            });
        }
    }

    /**
     * Helper to check user agent string to see if on Mobile Safari browser
     *
     @returns {boolean} True if visiting from Mobile Safari
     */
    function isMobileSafari() {
        var ua = window.navigator.userAgent;
        var iOS = /iP(ad|hone)/i.test(ua); // iPad / iPhone
        var webkit = /WebKit/i.test(ua);
        // Chrome and Opera also report WebKit
        return iOS && webkit && !(/CriOS/i.test(ua)) && !(/OPiOS/i.test(ua));
    }

})(jQuery, CAC.Control.FilterOptions, CAC.Control.ModeOptions, CAC.Map.Control,
    CAC.Control.TripOptions, CAC.Search.SearchParams, CAC.Control.Tab, CAC.User.Preferences,
    CAC.UrlRouting.UrlRouter, CAC.Utils);
