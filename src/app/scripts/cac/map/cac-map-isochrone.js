CAC.Map.IsochroneControl = (function ($, Handlebars, cartodb, L, turf, _) {
    'use strict';

    var defaults = {
        selectors: {
            destinationPopup: '.destination-directions-link',
            poiPopupClassName: 'poi-popup'
        }
    };

    var map = null;
    var tabControl = null;

    var events = $({});
    var eventNames = {
        destinationPopupClick: 'cac:isochrone:control:destinationpopup',
    };

    var isochroneLayer = null;
    var destinationMarkers = {};
    var destinationsLayer = null;
    var lastHighlightedMarkers = null;
    var options = null;
    var destinationIcon = L.AwesomeMarkers.icon({
        icon: 'default',
        prefix: 'icon',
        markerColor: 'orange'
    });
    var destinationOutsideTravelshedIcon = L.AwesomeMarkers.icon({
        icon: 'default',
        prefix: 'icon',
        // modified by styles to actually be orange, with reduced opacity
        markerColor: 'darkred',
        extraClasses: 'outside'
    });
    var highlightIcon = L.AwesomeMarkers.icon({
        icon: 'default',
        prefix: 'icon',
        markerColor: 'blue',
    });


    /**
     * Variables used for limiting to one isochrone request at a time.
     * Unlike the planTrip request, the isochrone request cannot be handled
     * solely via debounce, due to differences in the way the isochrone
     * request flows through the system. There are actions that take place
     * on this module (drawing the isochrone on the map), and then actions
     * that take place on the sidebar module (generating the destinations),
     * so doing the limiting correctly is more of a challenge.
     */
    var activeIsochroneRequest = null;
    var pendingIsochroneRequest = null;

    function IsochroneControl(opts) {
        this.events = events;
        this.eventNames = eventNames;
        options = $.extend({}, defaults, opts);
        map = opts.map;
        tabControl = opts.tabControl;
    }

    IsochroneControl.prototype.clearIsochrone = clearIsochrone;
    IsochroneControl.prototype.fetchIsochrone = fetchIsochrone;
    IsochroneControl.prototype.drawDestinations = drawDestinations;
    IsochroneControl.prototype.clearDestinations = clearDestinations;
    IsochroneControl.prototype.highlightDestinations = highlightDestinations;

    return IsochroneControl;


    /**
     * Add isochrone outline to map
     */
    function drawIsochrone(isochrone, zoomToFit) {
        try {
            isochroneLayer = cartodb.L.geoJson(isochrone, {
                clickable: false,
                style: {
                    clickable: false,
                    color: '#60a244',
                    fillColor: '#60a244',
                    lineCap: 'round',
                    lineJoin: 'round',
                    opacity: 0.4,
                    fillOpacity: 0.3,
                    stroke: true,
                    weight: 2
                }
            });
        } catch (err) {
            console.error('isochrone layer failed to load from GeoJSON');
            console.error(err);
            isochroneLayer = null;
        }

        if (isochroneLayer) {
            isochroneLayer.addTo(map);
            if (zoomToFit) {
                map.fitBounds(isochroneLayer.getBounds());
            }
        }
    }

    /**
     * Fetch an isochrone (travelshed) and the places within it.
     *
     * @return {Object} Promise resolving to JSON with isochrone and destinations
     */
    function _fetchIsochrone(payload) {
        var isochroneUrl = '/map/reachable';
        var deferred = $.Deferred();
        $.ajax({
            type: 'GET',
            data: payload,
            dataType: 'json',
            crossDomain: true,
            url: isochroneUrl
        }).done(deferred.resolve).fail(deferred.reject);
        return deferred.promise();
    }

    /**
     * Makes an isochrone request. Only allows one isochrone request at a time.
     * If another request comes in while one is active, the results of the active
     * request will be discarded upon completion, and the new query issued.
     * Draws isochrone on query completion, and resolves with the destinations.
     *
     * @param {Deferred} A jQuery Deferred object used for resolution
     * @param {Object} Parameters to be sent along with the request
     * @param {boolean} Whether to pan/zoom map to fit returned isochrone
     * @return {Object} Promise resolving to JSON with destinations
     */
    function getIsochrone(deferred, params, zoomToFit) {

        // remove optimization parameter, if set; causes excessively long isochrone query times
        delete params.optimize;

        // Check if there's already an active request. If there is one,
        // then we can't make a query yet -- store it as pending.
        // If there was already a pending query, immediately resolve it.
        if (activeIsochroneRequest) {
            if (pendingIsochroneRequest) {
                pendingIsochroneRequest.deferred.resolve();
            }
            pendingIsochroneRequest = { deferred: deferred, params: params, zoomToFit: zoomToFit };
            return;
        }

        // Set the active isochrone request and make query
        activeIsochroneRequest = { deferred: deferred, params: params, zoomToFit: zoomToFit };
        _fetchIsochrone(params).then(function(data) {
            activeIsochroneRequest = null;
            if (pendingIsochroneRequest) {
                // These results are already out of date. Don't display them, and instead
                // send off the pending request.
                deferred.resolve();

                var pending = pendingIsochroneRequest;
                pendingIsochroneRequest = null;
                getIsochrone(pending.deferred, pending.params, zoomToFit);
                return;
            }

            if (!tabControl.isTabShowing(tabControl.TABS.EXPLORE)) {
                // if user has switched away from the explore tab, do not show results
                deferred.resolve();
                return;
            }
            drawIsochrone(data.isochrone, zoomToFit);
            deferred.resolve(data.matched);
        }, function(error) {
            activeIsochroneRequest = null;
            pendingIsochroneRequest = null;
            console.error(error);
            deferred.reject(error);
        });
    }

    /**
     * Get travelshed and destinations within it, then display results on map.
    */
    function fetchIsochrone(coordsOrigin, when, exploreMinutes, otpParams, zoomToFit) {
        var deferred = $.Deferred();
        // clear results of last search
        clearIsochrone();

        var formattedTime = when.format('hh:mma');
        var formattedDate = when.format('YYYY/MM/DD');

        var params = {
            time: formattedTime,
            date: formattedDate,
            cutoffSec: exploreMinutes * 60 // API expects seconds
        };

        // Default precision of 200m; 100m seems good for improving response times on non-transit
        // http://dev.opentripplanner.org/apidoc/0.12.0/resource_LIsochrone.html
        if (otpParams.mode === 'WALK' || otpParams.mode === 'BICYCLE') {
            params.precisionMeters = 100;
        }

        params = $.extend(otpParams, params);

        if (coordsOrigin) {
            params.fromPlace = coordsOrigin.join(',');
            getIsochrone(deferred, params, zoomToFit);
        }

        return deferred.promise();
    }

    /**
     * Draw an array of geojson destination points onto the map
     *
     * @param {Array} all All destinations to draw
     * @param {Array} matched IDs of matched Destinations witin the travelshed
     * @param {Boolean} zoomToFit If true, zoom map to fit all markers
     */
    function drawDestinations(all, matched, zoomToFit) {
        // put destination details onto point geojson object's properties
        // build map of unconverted destination objects
        var destinations = {};
        clearDestinations();

        var locationGeoJSON = _.chain(all).map(function(place) {
            var destinations = [];
            // Pull in any unpublished destinations on published events or tours
            if (place.destinations && place.destinations.length) {
                destinations = place.destinations;
            } else if (!place.is_event && !place.is_tour) {
                destinations = [place];
            }
            return destinations;
        }).flatten().uniqBy('id').map(function(destination) {
            // set matched property to true if place is within isochrone
            destination.matched = _.findIndex(matched, function(match) {
                return match === destination.id;
            }) > -1;
            destinations[destination.id] = destination;
            var point = _.property('point')(destination);
            point.properties = _.omit(destination, 'point');
            point.properties.matched = !!destination.matched;
            return point;
        }).value();

        destinationMarkers = {};
        destinationsLayer = cartodb.L.geoJson(locationGeoJSON, {
            pointToLayer: function (geojson, latLng) {
                var popupTemplate = ['<h4>{{geojson.properties.name}}</h4>',
                                     '<div class="destination-description">',
                                    // HTML-formatted description
                                     geojson.properties.description,
                                     '</div>',
                                     '{{#if geojson.properties.related_tours.length}}',
                                     '<h4>Included in these tours:</h4>',
                                     '<div class="destination-description">',
                                     '{{#each geojson.properties.related_tours}}',
                                     '<a class="destination-website-link" target="_blank" ',
                                     'href="/tour/{{this.id}}/">{{this.name}}</a>',
                                     '{{/each}}',
                                     '</div>',
                                     '{{/if}}',
                                     '<p class="links"><a class="destination-website-link" ',
                                     'href="{{geojson.properties.website_url}}" ',
                                     'target="_blank">Visit website</a>',
                                     '<a class="destination-directions-link" ',
                                     'id="{{geojson.properties.id}}"',
                                     '>Get Directions</a></p>'
                                    ].join('');
                var template = Handlebars.compile(popupTemplate);
                var popupContent = template({geojson: geojson});
                var markerId = geojson.properties.id;

                // use a different icon for places outside of the travel than those within it
                var useIcon = geojson.properties.matched ? destinationIcon:
                    destinationOutsideTravelshedIcon;
                var marker = new cartodb.L.marker(latLng, {icon: useIcon})
                        .bindPopup(popupContent, {className: options.selectors.poiPopupClassName});
                marker.matched = geojson.properties.matched;
                destinationMarkers[markerId] = {
                    marker: marker,
                    destination: destinations[markerId]
                };

                // wait to bind popup click handlers until popup is in the DOM
                marker.on('click', function() {
                    // listen for clicks to get directions to place
                    $(options.selectors.destinationPopup).click(function(event) {
                        event.preventDefault();
                        events.trigger(eventNames.destinationPopupClick,
                                       destinationMarkers[event.currentTarget.id].destination);
                    });
                });
                return marker;
            }
        }).addTo(map);

        if (zoomToFit) {
            var markers = _.flatMap(destinationMarkers, 'marker._latlng');
            if (!_.isEmpty(markers)) {
                // zoom to fit all markers if several, or if there's only one, center on it
                if (markers.length > 1) {
                    map.fitBounds(L.latLngBounds(markers), { maxZoom: defaults.zoom });
                } else {
                    map.setView(markers[0].getLatLng());
                }
            }
        }
    }

    function highlightDestinations(destinationIds, opts) {
        var defaults = {
            panTo: false
        };

        var highlightOpts = $.extend({}, defaults, opts);

        // If passed no destinations to highlight, un-highlight instead
        if ((!destinationIds || !destinationIds.length) && lastHighlightedMarkers) {
            _.each(lastHighlightedMarkers, function(marker) {
                var icon = marker.matched ? destinationIcon:
                    destinationOutsideTravelshedIcon;
                marker.setIcon(icon);
            });
            lastHighlightedMarkers = null;
            return;
        }
        // Update icons for passed destinations
        lastHighlightedMarkers = [];
        _.each(destinationIds, function(placeId) {
            var marker = destinationMarkers[placeId];
            if (marker) {
                marker = marker.marker;
                marker.setIcon(highlightIcon);
                lastHighlightedMarkers.push(marker);
            }
        });
        // pan to the first destination of those passed, if panning option set
        if (highlightOpts.panTo && lastHighlightedMarkers.length) {
            map.panTo(lastHighlightedMarkers[0].getLatLng());
        }
    }

    function clearDestinations() {
        if (destinationsLayer) {
            map.removeLayer(destinationsLayer);
        }
    }

    function clearIsochrone() {
        if (isochroneLayer) {
            map.removeLayer(isochroneLayer);
        }
    }

})(jQuery, Handlebars, cartodb, L, turf, _);
