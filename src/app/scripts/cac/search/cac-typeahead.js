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
CAC.Search.Typeahead = (function (_, $, Geocoder, SearchParams) {
    'use strict';

    var defaults = {
        highlight: true,
        minLength: 1, // empty input is checked differently, 0 minLength no longer needed
        autoselect: true
    };
    var defaultTypeaheadKey = 'default';
    var eventNames = {
        cleared: 'cac:typeahead:cleared',
        selected: 'cac:typeahead:selected'
    };

    function CACTypeahead(selector, options) {
        this.options = $.extend({}, defaults, options);
        this.suggestAdapter = suggestAdapterFactory();
        this.destinationAdapter = destinationAdapterFactory();

        // Define event objects within the constructor so events aren't shared among all typeaheads
        this.events = $({});
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

            // Add locator button and wire it up
            var locatorTemplate = '<span class="glyphicon glyphicon-globe locate-icon"/>';
            var $locator = $(locatorTemplate).insertBefore(this.$element);
            if ('geolocation' in navigator) {
                this.$element.parent().on('click', '.locate-icon', function() {
                    navigator.geolocation.getCurrentPosition(function(pos) {
                        var coords = pos.coords;
                        Geocoder.reverse(coords.latitude, coords.longitude).then(function (data) {
                            if (data && data.address) {
                                /*jshint camelcase: false */
                                var fullAddress = data.address.Match_addr;
                                /*jshint camelcase: true */

                                // TODO: wire this up
                                console.log(fullAddress);
                            }
                        });

                    });
                });
            }

            // Trigger cleared event when user clears the input via keyboard or clicking the x
            var typeaheadKey = $(selector).data('typeahead-key') || defaultTypeaheadKey;
            var events = this.events;
            this.$element.on('keyup search', function() {
                var $element = $(this);
                if ($element.val()) {
                    $locator.hide();
                } else {
                    $element.typeahead('close');
                    events.trigger(eventNames.cleared, [typeaheadKey]);
                    $locator.show();
                }
            });
        }, this);

        createTypeahead();
    }

    return CACTypeahead;

    function onTypeaheadSelected(event, suggestion, dataset) {
        var typeaheadKey = $(event.currentTarget).data('typeahead-key') || defaultTypeaheadKey;
        var events = this.events;

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
                    // Must only use objects with isCollection set to false. Collections
                    // do not behave well with the follow-up geocode.
                    // See: https://github.com/azavea/cac-tripplanner/issues/307
                    return _.filter(list.suggestions, { isCollection: false });
                }
            }
        });
        adapter.initialize();
        return adapter;
    }

})(_, jQuery, CAC.Search.Geocoder, CAC.Search.SearchParams);
