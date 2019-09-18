// Karma configuration
// Generated on Wed Jan 21 2015 23:35:38 GMT+0000 (UTC)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '/opt/app/src',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      // console polyfills
      '/srv/cac/scripts/vendor/index.js',
      '/srv/cac/scripts/vendor/jquery.js',
      '/srv/cac/scripts/vendor/lodash.js',
      // load moment before other vendor scripts; is requirement for bootstrap datetime picker
      '/srv/cac/scripts/vendor/moment.js',
      '/srv/cac/scripts/vendor/moment-duration-format.js',
      '/srv/cac/scripts/vendor/cartodb.uncompressed.js',
      '/srv/cac/scripts/vendor/Polyline.encoded.js',
      '/srv/cac/scripts/vendor/leaflet.awesome-markers.js',
      '/srv/cac/scripts/vendor/handlebars.js',
      '/srv/cac/scripts/vendor/route.js',
      '/srv/cac/scripts/vendor/tiny-slider.js',
      '/srv/cac/scripts/vendor/turf-helpers.js',
      '/srv/cac/scripts/vendor/turf-distance.js',
      '/srv/cac/scripts/vendor/turf-point-on-line.js',
      '/srv/cac/scripts/vendor/js.storage.js',
      '/srv/cac/scripts/vendor/typeahead.bundle.js',

      // should match order listed in base.html Django template
      'app/scripts/cac/cac.js',
      'app/scripts/cac/utils.js',
      'app/scripts/cac/user/cac-user-preferences.js',
      'app/scripts/cac/search/cac-search-params.js',
      'app/scripts/cac/search/cac-geocoder.js',
      'app/scripts/cac/search/cac-typeahead.js',
      'app/scripts/cac/control/cac-control-modal.js',
      'app/scripts/cac/share/cac-share-modal.js',
      'app/scripts/cac/control/cac-control-trip-options.js',
      'app/scripts/cac/routing/cac-routing-itinerary.js',
      'app/scripts/cac/routing/cac-routing-plans.js',
      'app/scripts/cac/places/cac-places.js',
      'app/scripts/cac/urlrouting/cac-urlrouting.js',
      'app/scripts/cac/map/cac-map-control.js',
      'app/scripts/cac/map/cac-map-isochrone.js',
      'app/scripts/cac/map/cac-map-itinerary.js',
      'app/scripts/cac/map/cac-map-overlays.js',
      'app/scripts/cac/map/cac-map-templates.js',
      'app/scripts/cac/home/cac-home-templates.js',
      'app/scripts/cac/control/cac-control-filter-options.js',
      'app/scripts/cac/control/cac-control-mode-options.js',
      'app/scripts/cac/control/cac-control-tab.js',
      'app/scripts/cac/control/cac-control-directions-form.js',
      'app/scripts/cac/control/cac-control-explore.js',
      'app/scripts/cac/control/cac-control-directions.js',
      'app/scripts/cac/control/cac-control-itinerary-list.js',
      'app/scripts/cac/control/cac-control-directions-list.js',
      'app/scripts/cac/control/cac-control-tour-list.js',
      'app/scripts/cac/pages/cac-pages-home.js',
      'app/scripts/cac/pages/cac-pages-directions.js',

      'test/spec/*.js',
      'test/spec/**/*.js'
    ],


    // list of files to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
        'app/scripts/**/*.js': ['coverage']
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', 'coverage'],


    coverageReporter: {
        dir : 'coverage/',
        reporters: [
            { type : 'text-summary' },
            { type : 'cobertura', subdir: '.', file: 'cobertura.xml' },
            { type : 'html', subdir: 'report-html' }
        ]
    },

    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['ChromeHeadless'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    customLaunchers: {
      ChromeHeadless: {
        base: 'Chromium',
        flags: ['--no-sandbox', '--disable-gpu', '--headless', '--remote-debugging-port=9222']
      }
    }
  });
};
