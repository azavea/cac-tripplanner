
CAC.Control.SidebarTab = (function ($) {

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

    SidebarTabControl.prototype.setTab = setTab;

    return SidebarTabControl;

    function setTab(tabId) {
        var $tabs = $wrapper.siblings('[data-sidebar-tab]');
        $tabs.addClass('hidden');
        $wrapper.siblings('.' + tabId).removeClass('hidden');

        this.events.trigger(events.tabShown, tabId);
    }

})(jQuery);