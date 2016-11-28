/**
 * Manage modals used to set and display trip planning options.
 */
CAC.Control.TripOptions = (function ($, Handlebars, moment, Modal) {
    'use strict';

    var defaults = {
        currentMode: 'WALK',
        selectors: {
            bodyModalClass: 'modal-options',
            selectedClass: 'selected', // used to mark selection from a list
            visibleClass: 'visible',
            listOptions: 'li.modal-list-choice',
            listOptionsClass: 'modal-list-choice',
            timingOptions: '.modal-options.timing-modal',
            timeOptionsId: 'options-timing-time',
            dayOptionsId: 'options-timing-day',

            bikeOptionsModal: '.modal-options.bike-options',
            walkOptionsModal: '.modal-options.walk-options',

            // mapping of menu option classes to the selector for the next modal to open
            bikeMenuOptions: {
                'modal-list-indego': '.modal-options.bike-share-select',
                'modal-list-timing': '.modal-options.timing-modal',
                'modal-list-ride': '.modal-options.bike-triangle'
            },

            walkMenuOptions: {
                'modal-list-timing': '.modal-options.timing-modal',
                'modal-list-accessibility': '.modal-options.accessibility-options'
            }
        }
    };
    var events = $({});
    var eventNames = {
        toggle: 'cac:control:tripoptions:toggle'
    };
    var options = {};
    var isBike = false; // in walk mode if false
    var modal = null;
    var modalSelector = null;
    var childModal = null;
    var childModalSelector = null;

    function TripOptionsControl(params) {
        options = $.extend({}, defaults, params);
        this.initialize();
    }

    TripOptionsControl.prototype = {
        initialize: initialize,
        events: events,
        eventNames: eventNames,
        open: open
    };

    return TripOptionsControl;

    function initialize() {
        if (options.currentMode.indexOf('BICYCLE') > -1) {
            modalSelector = options.selectors.bikeOptionsModal;
            isBike = true;
        } else {
            modalSelector = options.selectors.walkOptionsModal;
            isBike = false;
        }

        modal = new Modal({
            modalSelector: modalSelector,
            bodyModalClass: options.selectors.bodyModalClass,
            clickHandler: onClick,
            onClose: onClose
        });
    }

    function onClick(e) {
        var $el = $(e.target);

        var menuOptions = isBike ? options.selectors.bikeMenuOptions : options.selectors.walkMenuOptions;

        childModalSelector = _.find(menuOptions, function(option, key) {
            return $el.hasClass(key);
        });

        // populate date/time picker options
        if (childModalSelector === options.selectors.timingOptions) {
            $(childModalSelector).find('.modal-options-timing-fields').html(timingModalOptions());

            // listen to time/date selector changes
            $(childModalSelector).find('#' + options.selectors.dayOptionsId).change(function(e) {
                console.log(e);
                window.myTarget = $(e.target);
                console.log('picked:');
                console.log(Date($(e.target).val()));
            });
        }

        if (childModalSelector) {
            childModal = new Modal({
                modalSelector: childModalSelector,
                bodyModalClass: options.selectors.bodyModalClass,
                clickHandler: childModalClick,
                onClose: onChildModalClose
            });
            modal.close();
            childModal.open();
            $(childModalSelector).addClass(options.selectors.visibleClass);
        } else {
            console.error('could not find child menu for selected option');
        }
    }

    function onClose() {
        $(modalSelector).removeClass(options.selectors.visibleClass);
        console.log('TODO: implement close of parent modal');
        // TODO: should trigger re-query (also check if anything actually changed first?)
    }

    /**
     * Public function to pass through calls to open the top-level modal
     */
    function open() {
        $(modalSelector).addClass(options.selectors.visibleClass);
        modal.open();
    }

    function childModalClick(e) {
        console.log('TODO: implement click on child modal');
        var $el = $(e.target);

        window.myEl = $el;

        // toggle selected class to clicked item
        if ($el.hasClass(options.selectors.listOptionsClass)) {
            $(childModalSelector).find(options.selectors.listOptions)
                .removeClass(options.selectors.selectedClass);

            $el.addClass(options.selectors.selectedClass);
        } else if ($el.is('#' + options.selectors.timeOptionsId)) {
            console.log('picked a time');
        } else if ($el.is('#' + options.selectors.dayOptionsId)) {
            console.log('picked a date');
        } else {
            console.log('TODO: handle. clicked modal away from list option');
        }

        // TODO: how to handle close out?
        //childModal.close();
    }

    function onChildModalClose() {
        $(childModalSelector).removeClass(options.selectors.visibleClass);
        childModal = null;
        childModalSelector = null;
    }

    /**
     * Helper to generate options lists for days and times available for planning trip.
     *
     * @returns {String} HTML snippet with list items to replace content inside
                         modal-options-timing-fields
     */
    function timingModalOptions() {
        var source = [
            '<li><select class="modal-options-timing-select" id="{{dayOptionsId}}">',
                '<option value="{{today}}">Today</option>',
                '{{#each days}}',
                    '<option value="{{this.value}}">{{this.label}}</option>',
                '{{/each}}',
                '</select></li>',
                '<li><select class="modal-options-timing-select" id="{{timeOptionsId}}">',
                    '<option value="{{today}}">Now</option>',
                    '{{#each times}}',
                        '<option value="{{this.value}}">{{this.label}}</option>',
                    '{{/each}}',
                '</select></li>'
        ].join('');

        var now = moment();
        var day = now;
        var time = now;

        var days = [];
        for (var i = 1; i < 8; i++) {
            day = now.add(1, 'days');
            days.push({
                value: day,
                label: day.format('ddd MM/DD')
            });
        }

        var times = [];

        // round first listed time to 15 minutes
        var MS_TO_15_MIN = 15 * 60 * 1000;
        time = moment(Math.round((time - (MS_TO_15_MIN / 2)) / MS_TO_15_MIN) * MS_TO_15_MIN);

        // generate list of options in 15 minute increments for next 24 hour window
        for (var j = 0; j < 96; j++) {
            time = time.add(15, 'minutes');
            times.push({
                value: time,
                label: time.format('h:mm a')
            });
        }

        var template = Handlebars.compile(source);
        var html = template({
            dayOptionsId: options.selectors.dayOptionsId,
            timeOptionsId: options.selectors.timeOptionsId,
            days: days,
            times: times,
            today: now,
        });
        return html;
    }

})(jQuery, Handlebars, moment, CAC.Control.Modal);
