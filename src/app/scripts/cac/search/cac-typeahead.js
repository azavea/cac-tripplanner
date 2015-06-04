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
CAC.Search.Typeahead = (function (_, $, Geocoder, SearchParams, Utils) {
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

        // For keeping track of the last selected value
        this.lastSelectedValue = null;
        this.$element = null;

        var createTypeahead = _.bind(function() {
            var $element = $(selector).typeahead(this.options, {
                name: 'featured',
                displayKey: 'name',
                source: this.destinationAdapter.ttAdapter()
            }, {
                name: 'destinations',
                displayKey: 'text',
                source: this.suggestAdapter.ttAdapter()
            });
            this.$element = $element;

            var typeaheadKey = $(selector).data('typeahead-key') || defaultTypeaheadKey;
            var events = this.events;

            $element.on('typeahead:selected', $.proxy(onTypeaheadSelected, this));

            // Whenever the typeahead is switched away from (be it from a tab, click-away, etc.),
            // check to see whether or not the value in the typeahead is something that has been
            // selected. If it has not been selected, trigger a change even with a null location
            // in order to warn listeners that the displayed value has not been geocoded.
            $element.blur($.proxy(function() {
                if ($element.typeahead('val') !== this.lastSelectedValue) {
                    var key = $(event.currentTarget).data('typeahead-key') || defaultTypeaheadKey;
                    this.events.trigger(eventNames.selected, [key, null]);
                }
            }, this));

            // Add locator button and wire it up
            var locatorTemplate = '<i class="fa fa-crosshairs locate-icon"></i>';
            var $locator = $(locatorTemplate).insertBefore($element);
            if ('geolocation' in navigator) {
                $element.parent().on('click', '.locate-icon', function() {
                    navigator.geolocation.getCurrentPosition(function(pos) {
                        var coords = pos.coords;
                        Geocoder.reverse(coords.latitude, coords.longitude).then(function (data) {
                            if (data && data.address) {
                                var location = Utils.convertReverseGeocodeToFeature(data);
                                /*jshint camelcase: false */
                                var fullAddress = data.address.Match_addr;
                                /*jshint camelcase: true */

                                $element.typeahead('val', fullAddress).change();
                                events.trigger(eventNames.selected, [typeaheadKey, location]);
                            }
                        });

                    });
                });
            }

            // Trigger cleared event when user clears the input via keyboard or clicking the x
            $element.on('keyup search change', function() {
                if ($element.val()) {
                    $locator.hide();
                } else {
                    $element.typeahead('close');
                    events.trigger(eventNames.cleared, [typeaheadKey]);
                    $locator.show();
                }
            });
        }, this);

        // Sets the value of the typeahead and calls its change event.
        // Use this instead of setting the typeahead element value directly, because
        // we need to keep track of the lastSelectedValue in order to look for when
        // a user tabs or clicks away from the typeahead without making a selection.
        this.setValue = $.proxy(function(val) {
            this.lastSelectedValue = val;
            this.$element.typeahead('val', val).change();
        }, this);

        createTypeahead();
    }

    return CACTypeahead;

    function onTypeaheadSelected(event, suggestion, dataset) {
        var typeaheadKey = $(event.currentTarget).data('typeahead-key') || defaultTypeaheadKey;
        var events = this.events;
        this.lastSelectedValue = suggestion.text;

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

})(_, jQuery, CAC.Search.Geocoder, CAC.Search.SearchParams, CAC.Utils);
