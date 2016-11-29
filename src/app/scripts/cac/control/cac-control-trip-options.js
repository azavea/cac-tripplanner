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
            timingFields: '.modal-options-timing-fields',
            timeOptionsId: 'options-timing-time',
            dayOptionsId: 'options-timing-day',
            departAt: '#departAt',

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

        if (!childModalSelector) {
            console.error('could not find child menu for selected option');
            return;
        }

        var childModalOptions = {
            modalSelector: childModalSelector,
            bodyModalClass: options.selectors.bodyModalClass,
            clickHandler: childModalClick,
            onClose: onChildModalClose
        };

        // populate date/time picker options
        if (childModalSelector === options.selectors.timingOptions) {
            // first read out previously set value, if any
            var selectedDay = $('#' + options.selectors.dayOptionsId).val();
            var selectedTime = $('#' + options.selectors.timeOptionsId).val();

            // set time and date selector options
            $(childModalSelector).find(options.selectors.timingFields).html(timingModalOptions());

            // set back previous selections for day and time
            if (selectedDay) {
                $(options.selectors.timingFields).find('#' + options.selectors.dayOptionsId)
                    .val(selectedDay);
            }

            if (selectedTime) {
                $(options.selectors.timingFields).find('#' + options.selectors.timeOptionsId)
                    .val(selectedTime);
            }

            // set 'clear' button event handler for timing options modal
            childModalOptions.clearHandler = onTimingModalClearClick;

            // listen to time/date selector changes
            $(childModalSelector).find('#' + options.selectors.dayOptionsId).change(function(e) {
                var $target = $(e.target);

                // TODO: set and read from storage
                console.log(moment(parseInt($target.val())));
            });
        }

        childModal = new Modal(childModalOptions);
        modal.close();
        childModal.open();
        $(childModalSelector).addClass(options.selectors.visibleClass);
    }

    function onClose() {
        $(modalSelector).removeClass(options.selectors.visibleClass);
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
        var $el = $(e.target);

        // toggle selected class to clicked item
        if ($el.hasClass(options.selectors.listOptionsClass)) {
            $(childModalSelector).find(options.selectors.listOptions)
                .removeClass(options.selectors.selectedClass);

            $el.addClass(options.selectors.selectedClass);

            // close child modal once option picked
            // should not happen with timing modal, which has its own close button
            if (childModalSelector !== options.selectors.timingOptions) {
                childModal.close();
            }

        } // else: user clicked somewhere on modal that is not an option; ignore
    }

    function onChildModalClose() {
        $(childModalSelector).removeClass(options.selectors.visibleClass);
        childModal = null;
        childModalSelector = null;

        // re-open parent modal on child modal close, to show selections
        if (childModalSelector !== options.selectors.timingOptions) {
            // rei-initialize first, to turn the click handlers back on
            initialize();
            open();
        }

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

        var time = moment();
        var today = moment().startOf('date'); // set to 12 AM to normalize
        var day = today.clone();

        var days = [];
        for (var i = 1; i < 8; i++) {
            day = day.add(1, 'days');
            days.push({
                value: day.unix(),
                label: day.format('ddd MM/DD')
            });
        }

        var times = [];

        // round first listed time to 15 minutes
        var MS_TO_15_MIN = 15 * 60 * 1000;
        time = moment(Math.round((time - (MS_TO_15_MIN / 2)) / MS_TO_15_MIN) * MS_TO_15_MIN);

        // generate list of options in 15 minute increments for next 24 hour window
        var QTR_HRS_IN_DAY = 96;
        for (var j = 0; j < QTR_HRS_IN_DAY; j++) {
            time = time.add(15, 'minutes');
            times.push({
                value: time.unix(),
                label: time.format('h:mm a')
            });
        }

        var template = Handlebars.compile(source);
        var html = template({
            dayOptionsId: options.selectors.dayOptionsId,
            timeOptionsId: options.selectors.timeOptionsId,
            days: days,
            times: times,
            today: today,
        });

        return html;
    }

    /**
     * Event handler for user click on 'clear' button on timing modal
     */
    function onTimingModalClearClick() {
        var $timing = $(options.selectors.timingFields);
        var $day = $timing.find('#' + options.selectors.dayOptionsId);
        var $time = $timing.find('#' + options.selectors.timeOptionsId);

        // set date and time selectors to first option, for today/now
        $day.val($day.find('option:first').val());
        $time.val($time.find('option:first').val());

        // reset to 'depart at'
        $(childModalSelector).find(options.selectors.departAt).click();

        // TODO: update user preferences as well
}

})(jQuery, Handlebars, moment, CAC.Control.Modal);
