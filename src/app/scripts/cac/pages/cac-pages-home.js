CAC.Pages.Home = (function ($) {
    'use strict';

    var defaults = {};

    function Home(options) {
        this.options = $.extend({}, defaults, options);
    }

    Home.prototype.initialize = function () {
        $('select').multipleSelect();
        $('.toggle-search button').on('click', function(){
            var id = $(this).attr('id');

            if (id === 'toggle-directions') {
                $('#explore').addClass('hidden');
                $('#directions').removeClass('hidden');
            } else {
                $('#directions').addClass('hidden');
                $('#explore').removeClass('hidden');
            }
        });

        this.typeahead  = new CAC.Search.Typeahead('input.typeahead');
        this.typeahead.events.on('cac:typeahead:selected', $.proxy(onTypeaheadSelected, this));
    };

    return Home;

    function onTypeaheadSelected(event, key, location) {
        console.log(key, location);
    }

})(jQuery);