var map = L.map('map', {
  center: [40.000, -75.1639],
  zoom: 12,
  zoomControl: false
});
var CartoDB_Positron = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
	subdomains: 'abcd',
	maxZoom: 19
}).addTo(map);

$(function() {
    $('html').on('click', 'a, button', function(e) {
        if ($(e.target).attr('href') == '#') {
            e.preventDefault();
        }
    });

    $('html').on('click', '.body-home .directions-to input', function(e) {
        e.preventDefault();
        this.blur();
        $('body').removeClass('body-home').addClass('body-map body-has-sidebar-banner');
    });

    $('body').on('click', '.route-summary', function(e) {
        $('body').addClass('body-step-by-step').removeClass('body-has-sidebar-banner');
        e.preventDefault();
    });

    $('body').on('click', '.back-to-directions-results', function(e) {
        e.preventDefault();
        this.blur();
        $('body').removeClass('body-step-by-step').addClass('body-has-sidebar-banner');
    });

    $('html').on('click', '.logo a', function(e) {
        e.preventDefault();
        $('body').removeClass('body-map body-step-by-step body-has-sidebar-banner').addClass('body-home');
    });

    $('.mode-toggle').on('click', '.mode-option', function(e) {
        $(this).toggleClass('on')
            .siblings('.mode-option').toggleClass('on');
        e.preventDefault();
    });

    $('body').on('click', '.mode-option.transit', function(e) {
        $(this).toggleClass('on off')
            .find('i').toggleClass('icon-transit-on icon-transit-off');
        e.preventDefault();
    });

    $('body').on('click', '.btn-options', function(e) {
        $('body').addClass('body-modal body-modal-options');
        e.preventDefault();
    });

    $('body').on('click', '.modal-panel', function(e) {
        e.stopPropagation();
    });

    $('body').on('click', '.btn-close-modal, .modal-overlay', function(e) {
        $('body').removeClass('body-modal body-modal-options body-modal-share');
        e.preventDefault();
    });

    $('body').on('click', '.share-directions', function(e) {
        $('body').addClass('body-modal body-modal-share');
        e.preventDefault();
    });

    $('body').on('click', '.btn-dismiss-sidebar-banner', function(e) {
        $('body').removeClass('body-has-sidebar-banner');
        e.preventDefault();
    });

    // The "post card" on the home page is a link to that post,
    // but also has a nested link to the learn page.
    // We can't nest <a> elements, so the nested element is a <button>.
    // While hovering, we replace the outer <a>'s href with this button's href
    // and let the click event bubble up to it.
    $('body').on('mouseover', '.goto-more-posts', function(e) {
        var parent = $(e.target).parents('.preview-card-link');
        var href = parent.attr('href');
        parent.attr('href', 'learn-index.html');
        $('body').one('mouseout', e.target, function(e) {
            parent.attr('href', href);
        });
    });
});
