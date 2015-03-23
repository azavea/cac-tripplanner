CAC.Pages.Home = (function ($, UserPreferences) {
    'use strict';

    var defaults = {
        selectors: {
            directionsForm: '#directions',
            directionsFrom: '#directionsFrom',
            directionsMode: '#directionsMode',
            directionsTo: '#directionsTo',
            exploreForm: '#explore',
            exploreMode: '#exploreMode',
            exploreOrigin: '#exploreOrigin',
            exploreTime: '#exploreTime',
            toggleButton: '.toggle-search button',
            typeahead: 'input.typeahead'
        }
    };
    var options = {};

    function Home(params) {
        options = $.extend({}, defaults, params);
    }

    Home.prototype.initialize = function () {
        $(options.selectors.toggleButton).on('click', function(){
            var id = $(this).attr('id');
            $(this).addClass('active');
            setTab(id);
        });

        this.typeahead = new CAC.Search.Typeahead(options.selectors.typeahead);
        this.typeahead.events.on('cac:typeahead:selected', $.proxy(onTypeaheadSelected, this));

        // save form data and redirect to map when 'go' button clicked
        $(options.selectors.exploreForm).submit(submitExplore);
        $(options.selectors.directionsForm).submit(submitDirections);

        $(document).ready(loadFromPreferences);
    };

    var submitDirections = function(event) {
        event.preventDefault();
        var mode = $(options.selectors.directionsMode).val();
        var fromText = $(options.selectors.directionsFrom).val();
        var toText = $(options.selectors.directionsTo).val();

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
    };

    var submitExplore = function(event) {
        event.preventDefault();
        var exploreTime = $(options.selectors.exploreTime).val();
        var mode = $(options.selectors.exploreMode).val();
        var originText = $(options.selectors.exploreOrigin).val();

        if (!originText) {
            // unset stored origin and use default, if none entered
            UserPreferences.setPreference('origin', undefined);
        }

        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreTime);
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('originText', originText);

        window.location = '/map';
    };

    var loadFromPreferences = function loadFromPreferences() {

        // only load preferences if they are set
        if (!UserPreferences.havePreferences()) {
            return;
        }

        var method = UserPreferences.getPreference('method');
        var mode = UserPreferences.getPreference('mode');
        setTab(method);

        // 'explore' tab options
        var originText = UserPreferences.getPreference('originText');
        var exploreTime = UserPreferences.getPreference('exploreTime');

        $(options.selectors.exploreOrigin).typeahead('val', originText);
        $(options.selectors.exploreTime).val(exploreTime);
        $(options.selectors.exploreMode).val(mode);

        // 'directions' tab options
        var fromText = UserPreferences.getPreference('fromText');
        var toText = UserPreferences.getPreference('toText');
        $(options.selectors.directionsFrom).typeahead('val', fromText);
        $(options.selectors.directionsTo).typeahead('val', toText);
        $(options.selectors.directionsMode).val(mode);
    };

    return Home;

    function onTypeaheadSelected(event, key, location) {
        event.preventDefault();  // do not submit form
        UserPreferences.setPreference(key, location);
    }

    function setTab(tab) {
        if (tab.indexOf('directions') > -1) {
            $(options.selectors.exploreForm).addClass('hidden');
            $(options.selectors.directionsForm).removeClass('hidden');
        } else {
            $(options.selectors.directionsForm).addClass('hidden');
            $(options.selectors.exploreForm).removeClass('hidden');
        }
    }

})(jQuery, CAC.User.Preferences);
