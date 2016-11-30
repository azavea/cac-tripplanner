/**
 * Manage modals used to set and display trip planning options.
 */
CAC.Control.TripOptions = (function ($, Handlebars, moment, Modal, UserPreferences) {
    'use strict';

    var defaults = {
        currentMode: 'WALK',
        selectors: {
            bodyModalClass: 'body-modal body-modal-options',
            selectedClass: 'selected', // used to mark selected list item
            visibleClass: 'visible',
            listOptions: 'li.modal-list-choice',
            listOptionsClass: 'modal-list-choice',
            departAt: '#departAt',

            // date/time selectors
            timingOptions: '.modal-options.timing-modal',
            timingFields: '.modal-options-timing-fields',
            timeOptionsId: 'options-timing-time',
            dayOptionsId: 'options-timing-day',
            nextQuarterHourClass: 'next-qtr-hour',
            earlierQuarterHourClass: 'earlier-qtr-hour',
            currentTimeClass: 'current-time',
            notTodayClass: 'not-today',
            firstOption: 'option:first',

            // the two top-level modals
            bikeOptionsModal: '.modal-options.bike-options',
            walkOptionsModal: '.modal-options.walk-options',

            // mapping of menu option classes to the selector for the child modal to open
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

            // set 'clear' button event handler for timing options modal
            childModalOptions.clearHandler = onTimingModalClearClick;

            // set time and date selector options
            $(childModalSelector).find(options.selectors.timingFields).html(timingModalOptions());

            // TODO: also read/set arriveBy selection

            // Set date/time selection back using what's stored in preferences.
            var storedDateTime = UserPreferences.getPreference('dateTime');

            var $day = $(options.selectors.timingFields)
                .find('#' + options.selectors.dayOptionsId);

            var $time = $(options.selectors.timingFields)
                .find('#' + options.selectors.timeOptionsId);

            var resetToNow = true; // set false when valid date and/or time option found
            if (storedDateTime) {
                // parse out the date and time portions
                var dt = moment.unix(storedDateTime);
                var day = dt.clone().startOf('date');
                var time = dt.diff(day, 'minutes'); // minutes since midnight on selected day

                // check if value is an available option before selecting it;
                // if not (more than a week passed?) will revert to default of 'now'
                if ($day.find('option[value="' + day.unix().toString() + '"]').length > 0) {
                    $day.val(day.unix().toString());
                    resetToNow = false;
                }

                if ($time.find('option[value="' + time + '"]').length > 0) {
                    $time.val(time);
                    resetToNow = false;
                }
            }

            // default to current date and time
            if (resetToNow) {
                UserPreferences.setPreference('dateTime', undefined);
                $day.val($day.find(options.selectors.firstOption).val());
                $time.val($time.find('.' + options.selectors.currentTimeClass).val());
            }
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

        } else {
            // user clicked somewhere on modal that is not a list item option

            if ($el.prop('id') === options.selectors.dayOptionsId) {
                if (!$el.val()) {
                    // set to current day

                    // hide times before 'now'
                    $(options.selectors.timingFields).removeClass(options.selectors.notTodayClass);
                    // TODO: set time to 'now' if selection is on or before next 15 minute increment


                } else {
                    // not today; hide 'now' option
                    $(options.selectors.timingFields).addClass(options.selectors.notTodayClass);
                    // TODO: set to next 15 minute increment if 'now' was selected

                }
            }
        }
    }

    function onChildModalClose() {
        // if closing the timing modal, read out the new date/time before exiting
        if (childModalSelector === options.selectors.timingOptions) {
            setDateTimeOnLocalStorage();
        }

        $(childModalSelector).removeClass(options.selectors.visibleClass);
        childModal = null;
        childModalSelector = null;

        // re-open parent modal on child modal close, to show selections
        open();
    }

    function setDateTimeOnLocalStorage() {
        var selectedDay = parseInt($('#' + options.selectors.dayOptionsId).val());
        var selectedTime = parseInt($('#' + options.selectors.timeOptionsId).val());

        var when;

        if (!!selectedTime && !!selectedDay) {
            when = moment.unix(selectedDay);

            // set the time portion on the selected day
            when.add(selectedTime, 'minutes');

        } else if (!!selectedTime) {
            // have time but not day; use today
            when = moment().startOf('date').add(selectedTime, 'minutes');
        } else {
            when = undefined;
        }

        if (when) {
            when = when.unix();
        }

        // store date/time as seconds since epoch
        UserPreferences.setPreference('dateTime', when);
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
                '<option value="">Today</option>',
                '{{#each days}}',
                    '<option value="{{this.value}}">{{this.label}}</option>',
                '{{/each}}',
                '</select></li>',
                '<li><select class="modal-options-timing-select" id="{{timeOptionsId}}">',
                    '{{#each times}}',
                        '<option class={{this.classes}} value="{{this.value}}">{{this.label}}</option>',
                    '{{/each}}',
                '</select></li>'
        ].join('');

        var midnight = moment().startOf('date'); // set to 12 AM to normalize
        var day = midnight.clone();

        // offer options for next 7 days
        var days = [];
        for (var i = 1; i < 8; i++) {
            day = day.add(1, 'days');
            days.push({
                value: day.unix(),
                label: day.format('ddd MM/DD')
            });
        }

        // generate list of options in quarter hour increments within a 24 hour window
        var times = [];
        // round current time up to the next minute
        var now = moment().add(1, 'minute').startOf('minute');
        var passedNow = false;

        // reset day to midnight
        day = midnight.clone();
        var MINUTES_IN_DAY = 24 * 60;

        for (var j = 0; j < MINUTES_IN_DAY; j = j + 15) {
            var classes = '';

            if (!passedNow) {
                // note times earlier than now to hide when selected day is today
                classes = options.selectors.earlierQuarterHourClass;

                passedNow = day > now;
                if (passedNow) {
                    // just found the next quarter hour from the current time; note it
                    classes = options.selectors.nextQuarterHourClass;
                    // also add an option for the current time
                    times.push({
                        value: '',
                        label: 'Now',
                        classes: options.selectors.currentTimeClass
                    });
                }
            }

            times.push({
                value: j,
                label: day.format('h:mm a'),
                classes: classes
            });

            day.add(15, 'minutes');
        }

        var template = Handlebars.compile(source);
        var html = template({
            dayOptionsId: options.selectors.dayOptionsId,
            timeOptionsId: options.selectors.timeOptionsId,
            days: days,
            times: times
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

        // set date and time selectors to today/now
        $day.val($day.find(options.selectors.firstOption).val());
        $time.val($time.find('.' + options.selectors.currentTimeClass).val());

        // reset to 'depart at'
        $(childModalSelector).find(options.selectors.departAt).click();

        // un-set user preferences (will revert to defaults)
        UserPreferences.setPreference('arriveBy', undefined);
        UserPreferences.setPreference('dateTime', undefined);
    }

})(jQuery, Handlebars, moment, CAC.Control.Modal, CAC.User.Preferences);
