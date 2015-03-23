/**
 *  Controls the sidebar tab switching for the map page
 *
 *  Events:
 *  @event cac:control:sidebartab:shown
 *  @property {string} tabId The tab id that was selected
 */
CAC.Control.SidebarTab = (function ($) {

    'use strict';

    var currentTab = 'explore';

    var defaults = {
        tabWrapperSelector: '.sidebar-tabs'
    };

    var events = {
        tabShown: 'cac:control:sidebartab:shown'
    };

    var $wrapper = null;

    function SidebarTabControl(options) {

        var self = this;

        self.options = $.extend({}, defaults, options);
        self.events = $({});
        $wrapper = $(self.options.tabWrapperSelector);

        $wrapper.find('button').on('click', function () {
            var $element = $(this);
            self.setTab($element.data('tab'));
        });
    }

    SidebarTabControl.prototype.isTabShowing = isTabShowing;
    SidebarTabControl.prototype.setTab = setTab;

    return SidebarTabControl;

    function isTabShowing(tabId) {
        return tabId === currentTab;
    }

    function setTab(tabId) {
        currentTab = tabId;
        var $tabs = $wrapper.siblings('[data-sidebar-tab]');
        $tabs.addClass('hidden');
        $tabs.removeClass('active');
        $wrapper.siblings('.' + tabId).removeClass('hidden');
        $wrapper.siblings('.' + tabId).addClass('active');

        var $buttons = $wrapper.children('button');
        $buttons.removeClass('active');
        $buttons.siblings('[data-tab=' + tabId + ']').addClass('active');

        this.events.trigger(events.tabShown, tabId);
    }

})(jQuery);
