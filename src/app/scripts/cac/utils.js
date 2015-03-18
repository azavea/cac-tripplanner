CAC.Utils = (function () {
    'use strict';

    var module = {
        getImageUrl: getImageUrl
    };

    return module;

    // Use with images in the app/images folder
    function getImageUrl(imageName) {
        return '/static/images/' + imageName;
    }

})();
