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
    var thisLocation = null;
    var triggerClear = null;

    function CACTypeahead(selector, options) {

        this.options = $.extend({}, defaults, options);
        this.events = $({});
        this.eventNames = {
            cleared: 'cac:typeahead:cleared',
            selected: 'cac:typeahead:selected'
        };

        this.suggestAdapter = suggestAdapterFactory();
        this.locationAdapter = locationAdapter;
        this.destinationAdapter = destinationAdapterFactory();

        // Bind function to module context so event may be triggered on input clear.
        // Note outstanding feature request for typeahead event to listen to for cleared input:
        // https://github.com/twitter/typeahead.js/issues/607
        var self = this;
        triggerClear = _.bind(function () {
            self.events.trigger(self.eventNames.cleared);
        }, self);


        var createTypeahead = _.bind(function() {
            this.$element = $(selector).typeahead(this.options, {
                name: 'featured',
                displayKey: 'name',
                source: this.destinationAdapter.ttAdapter()
            }, {
                name: 'destinations',
                displayKey: 'text',
                source: this.suggestAdapter.ttAdapter()
            }, {
                name: 'currentlocation',
                displayKey: 'name',
                source: this.locationAdapter
            });

            this.$element.on('typeahead:selected', $.proxy(onTypeaheadSelected, this));
        }, this);

        // create typeahead immediately, without current location to boost search results
        createTypeahead();

        // try to geolocate user for improved suggestions, then re-create typeahead if successful
        var setAdapter = _.bind(function() {
            this.suggestAdapter = suggestAdapterFactory();
            // destroy before re-cretating
            $(selector).typeahead('destroy', 'NoCached');
            createTypeahead();
        }, this);

        checkLocation(setAdapter);
    }

    return CACTypeahead;

    function onTypeaheadSelected(event, suggestion, dataset) {
        var self = this;
        var typeaheadKey = $(event.currentTarget).data('typeahead-key') || defaultTypeaheadKey;

        if (dataset === 'destinations') {
            CAC.Search.Geocoder.search(suggestion.text, suggestion.magicKey).then(
                function (location) {
                    // location will be null if no results found
                    self.events.trigger(self.eventNames.selected, [typeaheadKey, location]);
                }, function (error) {
                    console.error(error);
                });
        } else {
            // current location, or featured locations
            self.events.trigger(self.eventNames.selected, [typeaheadKey, suggestion]);
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

    function checkLocation(callback) {
        if ('geolocation' in navigator) {
            // set a watch on current location the first time it's requested
            navigator.geolocation.watchPosition(function(position) {
                var list = [{
                    name: 'Current Location',
                    feature: {
                        geometry: {
                            x: position.coords.longitude,
                            y: position.coords.latitude
                        }
                    }
                }];
                thisLocation = list;
                callback(thisLocation);
            }, function (error) {
                console.error('geolocation', error);
            }, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 10000
            });
        } else {
            console.error('geolocation not supported');
        }
    }

    function locationAdapter(query, callback) {
        // trigger 'cleared' event if typeahead input field is empty
        if (query === '') {
            triggerClear();
        }
        if (thisLocation) {
            callback(thisLocation);
        } else {
            checkLocation(callback);
        }
    }

    function suggestAdapterFactory() {
        var url = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';

        var params = {
            searchExtent: SearchParams.searchBounds,
            category: SearchParams.searchCategories,
            f: 'pjson'
        };

        // TODO: re-enable result distance ranking when bug fixed to work with searchExtent
        // https://geonet.esri.com/thread/132900
        /*
        // rank results by distance, if we have user location
        if (thisLocation) {
            params.location = [
                thisLocation[0].feature.geometry.x,
                thisLocation[0].feature.geometry.y
            ].join(',');
            params.distance = 16093; // ~10mi.
        }
        */

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
