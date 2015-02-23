CAC.Search.Typeahead = (function ($) {
    'use strict';

    var defaults = {
        highlight: true,
        minLength: 2
    };

    function CACTypeahead(selector, options) {

        this.options = $.extend({}, defaults, options);

        this.suggestAdapter = suggestAdapterFactory();
        this.destinationAdapter = destinationAdapterFactory();
        this.eventsAdapter = null;   // TODO: Add when we have an events search endpoint

        this.$element = $(selector).typeahead(this.options, {
            name: 'destinations',
            displayKey: 'text',
            source: this.suggestAdapter.ttAdapter()
        });
    }

    return CACTypeahead;

    function destinationAdapterFactory() {
        var adapter = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: {
                url: '/api/destinations/search?text=%QUERY',
                filter: function (list) {
                    return $.map(list, function (item) { return item.fields; });
                }
            }
        });
        adapter.initialize();
        return adapter;
    }

    function suggestAdapterFactory() {
        var url = 'http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';
        var params = {
            searchExtent: [
                '-75.243620',
                '39.898295',
                '-75.126531',
                '39.967842'
            ].join(','),
            category: 'Address,POI',
            f: 'pjson'
        };

        var adapter = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('text'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: {
                url: url + '?text=%QUERY&' + $.param(params),
                filter: function (list) {
                    return list.suggestions;
                }
            }
        });
        adapter.initialize();
        return adapter;
    }

})(jQuery);