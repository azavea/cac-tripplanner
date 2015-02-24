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
 * typeahead.events.on('cac:typeahead:selected', function () {});
 *
 * Events:
 *     - cac:typeahead:selected - Fired when the user selects an element in the list.
 *                                Two arguments:
 *                                    String typeaheadKey
 *                                    Object location
 */
CAC.Search.Typeahead = (function ($) {
    'use strict';

    var defaults = {
        highlight: true,
        minLength: 2
    };
    var defaultTypeaheadKey = 'default';

    function CACTypeahead(selector, options) {

        this.options = $.extend({}, defaults, options);
        this.events = $({});

        this.suggestAdapter = suggestAdapterFactory();
        this.locationAdapter = locationAdapter;
        this.eventsAdapter = null;   // TODO: Add when we have an events search endpoint

        this.$element = $(selector).typeahead(this.options, {
            name: 'currentlocation',
            displayKey: 'name',
            source: this.locationAdapter
        }, {
            name: 'destinations',
            displayKey: 'text',
            source: this.suggestAdapter.ttAdapter()
        });

        this.$element.on('typeahead:selected', $.proxy(onTypeaheadSelected, this));
    }

    return CACTypeahead;

    function onTypeaheadSelected(event, suggestion, dataset) {
        var self = this;
        var typeaheadKey = $(event.currentTarget).data('typeahead-key') || defaultTypeaheadKey;

        if (dataset === 'currentlocation') {
            self.events.trigger('cac:typeahead:selected', [typeaheadKey, suggestion]);
        } else {
            CAC.Search.Geocoder.search(suggestion.text, suggestion.magicKey).then(function (location) {
                self.events.trigger('cac:typeahead:selected', [typeaheadKey, location]);
            });
        }
    }

    // Unused, but might add later?
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

    function locationAdapter(query, callback) {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(function(position) {
                var list = [{
                    name: 'Current Location',
                    feature: {
                        geometry: {
                            x: position.coords.longitude,
                            y: position.coords.latitude
                        }
                    }
                }];
                callback(list);
            }, function (error) {
                console.error('geolocation', error);
            }, {
                enableHighAccuracy: true,
                timeout: 1000,
                maximumAge: 0
            });
        } else {
            console.error('geolocation not supported');
        }
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