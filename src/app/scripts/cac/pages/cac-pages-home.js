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

        this.typeahead = {
            explore: new CAC.Search.Typeahead('#typeahead-explore'),
            to: new CAC.Search.Typeahead('#typeahead-to'),
            from: new CAC.Search.Typeahead('#typeahead-from'),
        };
        this.typeaheads.explore.$element.on('typeahead:selected', $.proxy(onTypeaheadSelected, this));
        this.typeaheads.to.$element.on('typeahead:selected', $.proxy(onTypeaheadSelected, this));
        this.typeaheads.from.$element.on('typeahead:selected', $.proxy(onTypeaheadSelected, this));
    };

    return Home;

    function onTypeaheadSelected(event, suggestion, dataset) {
        console.log(suggestion);
    }

})(jQuery);