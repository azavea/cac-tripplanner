CAC.Map.IsochroneControl = (function ($, Handlebars, cartodb, L, turf, _) {
    'use strict';

    var defaults = {
        selectors: {
            destinationPopup: '.destination-directions-link'
        }
    };

    var map = null;
    var tabControl = null;

    var events = $({});
    var eventNames = {
        destinationPopupClick: 'cac:map:control:destinationpopup',
    };

    var isochroneLayer = null;
    var destinationMarkers = {};
    var destinationsLayer = null;
    var lastHighlightedMarker = null;
    var destinationIcon = L.AwesomeMarkers.icon({
        icon: 'marker-poi',
        prefix: 'icon',
        markerColor: 'darkblue'
    });
    var highlightIcon = L.AwesomeMarkers.icon({
        icon: 'marker-poi',
        prefix: 'icon',
        markerColor: 'blue'
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

    function IsochroneControl(options) {
        this.events = events;
        this.eventNames = eventNames;

        this.options = $.extend({}, defaults, options);
        map = options.map;
        tabControl = options.tabControl;

        // set listener for click event on destination popup
        $('#' + this.options.id).on('click', this.options.selectors.destinationPopup, function(event) {
            events.trigger(eventNames.destinationPopupClick,
                           destinationMarkers[event.currentTarget.id].destination);
        });
    }

    IsochroneControl.prototype.clearIsochrone = clearIsochrone;
    IsochroneControl.prototype.fetchIsochrone = fetchIsochrone;
    IsochroneControl.prototype.drawDestinations = drawDestinations;
    IsochroneControl.prototype.clearDestinations = clearDestinations;
    IsochroneControl.prototype.highlightDestination = highlightDestination;

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
     * Fetch all the reachable destinations within our destination database,
     * and their enclosing isochrone (travelshed).
     *
     * @return {Object} Promise resolving to JSON with 'matched' and 'isochrone' properties
     */
    function fetchReachable(payload) {
        var isochroneUrl = '/map/reachable';
        var deferred = $.Deferred();
        $.ajax({
            type: 'GET',
            data: payload,
            cache: false,
            url: isochroneUrl,
            contentType: 'application/json'
        }).done(deferred.resolve).fail(deferred.reject);
        return deferred.promise();
    }

    /**
     * Makes an isochrone request. Only allows one isochrone request at a time.
     * If another request comes in while one is active, the results of the active
     * request will be discarded upon completion, and the new query issued.
     *
     * @param {Deferred} A jQuery Deferred object used for resolution
     * @param {Object} Parameters to be sent along with the request
     * @param {boolean} Whether to pan/zoom map to fit returned isochrone
     */
    function getIsochrone(deferred, params, zoomToFit) {
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
        fetchReachable(params).then(function(data) {
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
            // also draw 'matched' list of locations
            drawDestinations(data.matched);
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
        clearDiscoverPlaces();

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
     */
    function drawDestinations(matched) {
        // put destination details onto point geojson object's properties
        // build map of unconverted destination objects
        var destinations = {};
        var locationGeoJSON = _.map(matched, function(destination) {
            destinations[destination.id] = destination;
            var point = _.property('point')(destination);
            point.properties = _.omit(destination, 'point');
            return point;
        });
        destinationMarkers = {};
        destinationsLayer = cartodb.L.geoJson(locationGeoJSON, {
            pointToLayer: function (geojson, latLng) {
                var popupTemplate = ['<h4>{{geojson.properties.name}}</h4>',
                                     '<div class="destination-description">',
                                    // HTML-formatted description
                                     geojson.properties.description,
                                     '</div>',
                                     '<a href="{{geojson.properties.website_url}}" ',
                                     'target="_blank">{{geojson.properties.website_url}}</a>',
                                     '<a class="destination-directions-link pull-right" ',
                                     'id="{{geojson.properties.id}}">Get Directions</a>'
                                    ].join('');
                var template = Handlebars.compile(popupTemplate);
                var popupContent = template({geojson: geojson});
                var markerId = geojson.properties.id;
                var marker = new cartodb.L.marker(latLng, {icon: destinationIcon})
                        .bindPopup(popupContent);
                destinationMarkers[markerId] = {
                    marker: marker,
                    destination: destinations[geojson.properties.id]
                };
                return marker;
            }
        }).addTo(map);
    }

    function highlightDestination(destinationId, opts) {
        var defaults = {
            panTo: false
        };
        var options = $.extend({}, defaults, opts);
        if (!destinationId) {
            // revert to original marker if set
            if (lastHighlightedMarker) {
                lastHighlightedMarker.setIcon(destinationIcon);
            }
            return;
        }
        // Update icon for passed destination
        var marker = destinationMarkers[destinationId].marker;
        marker.setIcon(highlightIcon);
        if (options.panTo) {
            map.panTo(marker.getLatLng());
        }
        lastHighlightedMarker = marker;
    }

    /**
     * Remove layers for isochrone and destinations within it.
     */
    function clearDiscoverPlaces() {
        clearDestinations();
        clearIsochrone();
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
