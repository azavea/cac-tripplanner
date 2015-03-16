
/**
 *  View control for the sidebar explore tab
 *
 */
CAC.Control.SidebarExplore = (function ($, MapTemplates) {

    'use strict';

    var defaults = {};
    var options = {};

    var events = $({});
    var eventNames = {
        destinationSelected: 'cac:control:sidebarexplore:destinationselected'
    };

    function SidebarExploreControl(params) {
        options = $.extend({}, defaults, params);

        $('.sidebar-options .view-more').click(showOptions);
    }

    SidebarExploreControl.prototype = {
        events: events,
        setDestinationSidebar: setDestinationSidebar
    };

    return SidebarExploreControl;

    function showOptions(event) {
        var parent = $(event.target).closest('section');
        var moreOpt = $('.sidebar-options .more-options', parent);

        $(moreOpt).toggleClass('active');
        $(moreOpt).parent().find('a.view-more').text(function() {
            if($(moreOpt).hasClass('active')){
                return 'View fewer options';
            } else {
                return 'View more options';
            }
        });
    }

    function setDestinationSidebar(destinations) {
        var $container = $('<div></div>').addClass('destinations');
        $.each(destinations, function (i, destination) {
            var $destination = $(MapTemplates.destinationBlock(destination));

            $destination.click(function () {
                events.trigger(eventNames.destinationSelected, destination);
            });
            $container.append($destination);
        });
        $('.explore div.sidebar-details').empty().append($container);
        $('.explore .sidebar-clip').height(400);
    }

})(jQuery, CAC.Map.Templates);
