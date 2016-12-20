/**
 *  Controls the tab switching for the home page
 *
 *  Events:
 *  @event cac:control:tab:shown
 *  @property {string} tabId The tab id that was selected
 */
CAC.Control.Tab = (function ($) {

    'use strict';

    var TABS = {
        HOME: 'HOME',
        DIRECTIONS: 'DIRECTIONS',
        EXPLORE: 'EXPLORE',
        LEARN: 'LEARN'
    };
    var currentTab = TABS.HOME;

    var defaults = {
        classes: {
            HOME: 'body-home',
            DIRECTIONS: 'body-map body-map-directions body-has-sidebar-banner',
            EXPLORE: 'body-map body-map-explore body-has-sidebar-banner',
            LEARN: 'body-learn'
        },
        selectors: {
            appBody: '#body-div'
        },
        router: null
    };

    var events = $({});
    var eventNames = {
        tabShown: 'cac:control:tab:shown'
    };

    function TabControl(options) {
        var self = this;

        self.options = $.extend({}, defaults, options);
        self.events = events;
        self.eventNames = eventNames;
        self.TABS = TABS;
        self.router = self.options.router;

        self.$body = $(self.options.selectors.appBody);
    }

    TabControl.prototype.getCurrentTab = getCurrentTab;
    TabControl.prototype.isTabShowing = isTabShowing;
    TabControl.prototype.setTab = setTab;

    return TabControl;

    function getCurrentTab() {
        return currentTab;
    }

    function isTabShowing(tabId) {
        return tabId === currentTab;
    }

    // Activates the given tab and broadcasts a 'tab shown' event, but does nothing if the
    // requested tab is already active.
    function setTab(tabId) {
        if (!TABS[tabId]) { return; }

        var oldTab = currentTab;
        currentTab = tabId;

        if (oldTab !== currentTab) {
            var newBodyClass = this.options.classes[currentTab];
            this.$body.removeClass();
            this.$body.addClass(newBodyClass);

            if (currentTab === TABS.HOME && this.router) {
                this.router.clearUrl();
            }

            this.events.trigger(eventNames.tabShown, tabId);
        }
    }

})(jQuery);
