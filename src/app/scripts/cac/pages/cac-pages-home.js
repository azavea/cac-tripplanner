CAC.Pages.Home = (function ($, UserPreferences) {
    'use strict';

    var defaults = {};

    function Home(options) {
        this.options = $.extend({}, defaults, options);
    }

    Home.prototype.initialize = function () {
        $('.toggle-search button').on('click', function(){
            var id = $(this).attr('id');

            if (id === 'toggle-directions') {
                $('#explore').addClass('hidden');
                $('#directions').removeClass('hidden');
            } else {
                $('#directions').addClass('hidden');
                $('#explore').removeClass('hidden');
            }
        });

        this.typeahead = new CAC.Search.Typeahead('input.typeahead');
        this.typeahead.events.on('cac:typeahead:selected', $.proxy(onTypeaheadSelected, this));
    };

    // save form data and redirect to map when 'go' button clicked

    $('#explore').submit(function(event) {
        event.preventDefault();
        var exploreTime = $('#exploreTime').val();
        var mode = $('#exploreMode').val();
        var originText = $('#exploreOrigin').val();

        if (!originText) {
            // unset stored origin and use default, if none entered
            UserPreferences.setPreference('origin', undefined);
        }

        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreTime);
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('originText', originText);

        window.location = '/map';
    });

    $('#directions').submit(function(event) {
        event.preventDefault();
        var mode = $('#directionsMode').val();
        var fromText = $('#directionsFrom').val();
        var toText = $('#directionsTo').val();

        // unset stored origin/destination and use defaults, if not entered
        if (!fromText) {
            UserPreferences.setPreference('from', undefined);
        }

        if (!toText) {
            UserPreferences.setPreference('to', undefined);
        }

        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('fromText', fromText);
        UserPreferences.setPreference('toText', toText);

        window.location = '/map';
    });

    return Home;

    function onTypeaheadSelected(event, key, location) {
        event.preventDefault();  // do not submit form
        UserPreferences.setPreference(key, location);
    }

})(jQuery, CAC.User.Preferences);
