CAC.Map.Control = (function ($, L) {
    'use strict';

    var defaults = {
        id: 'map',
        center: [39.95, -75.1667],
        zoom: 14
    };
    var map = null;
    var attribution = [
        'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
        'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
        'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
        'under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
    ].join('');

    function MapControl(options) {
        this.options = $.extend({}, defaults, options);
        map = L.map(this.options.id).setView(this.options.center, this.options.zoom);

        L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png', {
            attribution: attribution
        }).addTo(map);
    }

    return MapControl;
})(jQuery, L);