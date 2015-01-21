CAC.Map.Control = (function ($, L) {
    'use strict';

    var defaults = {
        id: 'map',
        center: [39.95, -75.1667],
        zoom: 14
    };
    var map = null;

    function MapControl(options) {
        this.options = $.extend({}, defaults, options);
        map = L.map(this.options.id).setView(this.options.center, this.options.zoom);

        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    }

    return MapControl;
})(jQuery, L);