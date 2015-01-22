CAC.Map.OverlaysControl = (function ($, L) {
    'use strict';

    var defaults = {};

    function OverlaysControl(options) {
        this.options = $.extend({}, defaults, options);
    }

    OverlaysControl.prototype.bikeShareOverlay = bikeShareOverlay;
    OverlaysControl.prototype.bikeParkingOverlay = bikeParkingOverlay;

    return OverlaysControl;

    // TODO: Implement - This may not be the best way to architect these depending on how these
    //                      layers are added
    function bikeShareOverlay() {
        return L.featureGroup([]);
    }

    // TODO: Implement
    function bikeParkingOverlay() {
        return L.featureGroup([]);
    }

})(jQuery, L);