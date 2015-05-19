/**
 * CAC.Search.Typeahead
 *
 * If attaching to multiple elements, add a data-typeahead-key attribute with a unique value
 *     to each input element. The typeaheadKey will be passed to the event handler for
 *     cac:typeahead:selected.
 *
 * All events are fired on the events property of the typeahead instance.
 * e.g:
 * var typeahead = new CAC.Search.Typeahead(...)
 * typeahead.events.on(typeahead.eventNames.selected, function () {});
 *
 * Events:
 *     - cac:typeahead:selected - Fired when the user selects an element in the list.
 *                                Two arguments:
 *                                    String typeaheadKey
 *                                    Object location
 */
CAC.Search.Typeahead = (function (_, $, SearchParams) {
    'use strict';

    var defaults = {
        highlight: true,
        minLength: 0, // set minLength to 0 so can check for empty input
        autoselect: true
    };
    var defaultTypeaheadKey = 'default';
    var events = $({});
    var eventNames = {
        cleared: 'cac:typeahead:cleared',
        selected: 'cac:typeahead:selected'
    };

    function CACTypeahead(selector, options) {
        this.options = $.extend({}, defaults, options);
        this.suggestAdapter = suggestAdapterFactory();
        this.destinationAdapter = destinationAdapterFactory();

        this.events = events;
        this.eventNames = eventNames;

        var createTypeahead = _.bind(function() {
            this.$element = $(selector).typeahead(this.options, {
                name: 'featured',
                displayKey: 'name',
                source: this.destinationAdapter.ttAdapter()
            }, {
                name: 'destinations',
                displayKey: 'text',
                source: this.suggestAdapter.ttAdapter()
            });

            this.$element.on('typeahead:selected', $.proxy(onTypeaheadSelected, this));
        }, this);

        createTypeahead();
    }

    return CACTypeahead;

    function onTypeaheadSelected(event, suggestion, dataset) {
        var typeaheadKey = $(event.currentTarget).data('typeahead-key') || defaultTypeaheadKey;

        if (dataset === 'destinations') {
            CAC.Search.Geocoder.search(suggestion.text, suggestion.magicKey).then(
                function (location) {
                    // location will be null if no results found
                    events.trigger(eventNames.selected, [typeaheadKey, location]);
                }, function (error) {
                    console.error(error);
                });
        } else {
            // featured locations
            events.trigger(eventNames.selected, [typeaheadKey, suggestion]);
        }
    }

    function destinationAdapterFactory() {
        var adapter = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: {
                url: '/api/destinations/search?text=%QUERY',
                filter: function (response) {
                    if (response && response.destinations.length) {
                        return response.destinations;
                    } else {
                        return [];
                    }
                }
            }
        });
        adapter.initialize();
        return adapter;
    }

    function suggestAdapterFactory() {
        var url = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';

        var params = {
            searchExtent: SearchParams.searchBounds,
            category: SearchParams.searchCategories,
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

})(_, jQuery, CAC.Search.SearchParams);
