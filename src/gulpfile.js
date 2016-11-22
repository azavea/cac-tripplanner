/* jshint node:true */
'use strict';

var addsrc = require('gulp-add-src');
var aliasify = require('aliasify');
var browserify = require('browserify');
var concat = require('gulp-concat');
var debug = require('gulp-debug');
var del = require('del');
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var fontello = require('gulp-fontello');
var merge = require('merge-stream');
var pump = require('pump');
var sass = require('gulp-sass');
var jshintXMLReporter = require('gulp-jshint-xml-file-reporter');
var KarmaServer = require('karma').Server;
var mainBower = require('main-bower-files');
var order = require('gulp-order');
var plumber = require('gulp-plumber');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var sequence = require('gulp-sequence');
var shell = require('gulp-shell');
var uglify = require('gulp-uglify');
var vinylBuffer = require('vinyl-buffer');
var vinylSourceStream = require('vinyl-source-stream');
var $ = require('gulp-load-plugins')();

var staticRoot = '/srv/cac';
var pythonRoot = '/opt/app/python/cac_tripplanner';

var filterCSS = gulpFilter(['**/*.css', '!**/leaflet.css'], {restore: true});

var stat = {
    fonts: staticRoot + '/fontello',
    scripts: staticRoot + '/scripts',
    styles: staticRoot + '/styles',
    images: staticRoot + '/images'
};

var cartoDbRoot = 'bower_components/cartodb.js/cartodb.uncompressed.js';

// Define the minification order for our js files
var scriptOrder = [
    // We aren't using an automatic dependency management system,
    // so this needs to be managed manually. This is very error-prone
    // and we should consider moving to something more manageable.
    '**/cac.js',
    '**/utils.js',
    '**/cac/search/cac-search-params.js',
    '**/cac/map/cac-map-templates.js',
    '**/cac/control/cac-control-modal.js',
    '**/cac/share/*.js',
    '**/cac/user/*.js',
    '**/cac/search/*.js',
    '**/cac/routing/*.js',
    '**/cac/urlrouting/*.js',
    '**/cac/control/cac-control-mode-options.js',
    '**/cac/control/*.js',
    '**/cac/map/*.js',
    '**/cac/home/*.js',
    '**/*.js',
];

// Helper for copying over bower files
var copyBowerFiles = function(filter, extraFiles) {
    return gulp.src(mainBower())
        .pipe(gulpFilter(filter))
        .pipe(addsrc(extraFiles));
};

gulp.task('collectstatic', function () {
    return shell.task(['python ' + pythonRoot + '/manage.py collectstatic --noinput -v0']);
});

// turf module needs to be run through browserify to pack it with its dependencies
var turfDistanceRoot = './node_modules/@turf/nearest/node_modules/@turf/distance';

var buildTurfHelpers = function() {
    return browserify(turfDistanceRoot + '/node_modules/@turf/helpers', {
            standalone: 'turf',
            expose: ['helpers']
        })
        .require(turfDistanceRoot + '/node_modules/@turf/helpers',
                 {expose: 'turf-helpers'})
        .bundle()
        .pipe(vinylSourceStream('turf-helpers.js'));
};

var buildTurfPointOnLine = function() {
    return browserify('./node_modules/@turf/nearest', {
            standalone: 'turf.nearest',
            exclude: [turfDistanceRoot + '/node_modules/@turf/helpers']
        })
        .transform(aliasify, {aliases: {
            'turf-helpers': turfDistanceRoot + '/node_modules/@turf/helpers',
            'turf-invariant': turfDistanceRoot + '/node_modules/@turf/invariant',
            'turf-distance': turfDistanceRoot
        }})
        .bundle()
        .pipe(vinylSourceStream('turf-nearest.js'));
};

// combine streams from turf and the other vendor dependencies
var copyVendorJS = function(filter, extraFiles) {
    var bowerStream = copyBowerFiles(filter, extraFiles);
    var vendorStream = merge(buildTurfHelpers(), buildTurfPointOnLine());
    vendorStream.add(bowerStream);
    // do a global search-and-replace for jQuery's ajax in vendor scripts, to fix
    // running jQuery in noConflict mode for JotForms.
    // (Breaks loading Carto layers when it tries to reference $.ajax.)
    vendorStream.pipe(replace(/\$\.ajax/g, 'jQuery.ajax'));
    return vendorStream;
};

gulp.task('clean', function() {
    // This must be done synchronously to prevent sporadic failures
    return del.sync([
        stat.fonts,
        stat.scripts,
        stat.styles,
        stat.images
    ], { force: true });
});

gulp.task('minify:scripts', function(cb) {
    pump([
        gulp.src(['app/scripts/**/*.js']),
        order(scriptOrder),
        vinylBuffer(),
        concat('main.js'),
        uglify(),
        gulp.dest(stat.scripts)
    ], cb);
});

gulp.task('minify:vendor-scripts', function(cb) {
    pump([
         copyVendorJS(['**/*.js',
                        // Exclude minified vendor scripts that also have a non-minified version.
                        // We run our own minifier, and want to include each script only once.
                        '!**/*.min.js',
                        // exclude leaflet and jquery (loaded over CDN)
                        '!**/leaflet.js', '!**/leaflet-src.js', '!**/jquery.js', '!**/jquery.min.js'],
                        []),
        vinylBuffer(),
        concat('vendor.js'),
        uglify(),
        gulp.dest(stat.scripts)
    ], cb);
});

gulp.task('copy:scripts', function() {
    return gulp.src('app/scripts/**/*.js')
        .pipe(order(scriptOrder))
        .pipe(gulp.dest(stat.scripts + '/main'));
});

gulp.task('copy:vendor-css', function() {
    return copyBowerFiles(['**/*.css',
                          '!**/*.min.css',
                          // leaflet loaded over CDN
                          '!**/leaflet.css'], [])
        .pipe(concat('vendor.css'))
        .pipe($.autoprefixer({
            browsers: ['last 2 versions'],
            cascade: false
        }))
        .pipe(gulp.dest(stat.styles));
});

gulp.task('copy:vendor-images', function() {
    return copyBowerFiles(['**/*.png'], [])
        .pipe(gulp.dest(stat.images + '/vendor'));
});

gulp.task('copy:marker-images', function() {
    return gulp.src(['bower_components/*eaflet*/dist/images/*.png'])
        .pipe(rename({dirname: ''}))
        .pipe(gulp.dest(stat.styles + '/images'));
});

gulp.task('copy:fontello-fonts', function() {
    return gulp.src('app/font/fontello/config.json')
    .pipe(fontello())
    .pipe(gulp.dest(stat.fonts));
});

gulp.task('copy:app-images', function() {
    return gulp.src('app/images/**/*.*')
        .pipe(gulp.dest(stat.images));
});

gulp.task('copy:vendor-scripts', function() {
    return copyVendorJS(['**/*.js',
                        // exclude minified versions
                        '!**/*.min.js',
                        // exclude leaflet
                        '!**/leaflet.js', '!**/leaflet-src.js', '!**/cartodb**'],
                        // load the uncompressed version of CartoDB in development,
                        // for easier debugging
                        ['bower_components/cartodb.js/cartodb.uncompressed.js'])
        .pipe(gulp.dest(stat.scripts + '/vendor'));
});

gulp.task('jshint', function () {
    return gulp.src('app/scripts/cac/**/*.js')
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish'))
        .pipe($.jshint.reporter('fail'));
});

gulp.task('jshint:jenkins', function () {
    return gulp.src('app/scripts/cac/**/*.js')
        .pipe($.jshint())
        .pipe($.jshint.reporter(jshintXMLReporter))
        .on('end', jshintXMLReporter.writeFile({
            alwaysReport: true,
            format: 'jslint',
            filePath: 'coverage/jshint-output.xml'
        }))
        .pipe($.jshint.reporter('fail'));
});

gulp.task('sass', function () {
    return gulp.src('app/styles/main.scss')
        .pipe(plumber())
        .pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError))
        .pipe(filterCSS)
        .pipe($.autoprefixer({browsers: ['last 2 versions'], cascade: false}))
        .pipe(filterCSS.restore)
        .pipe(gulp.dest(stat.styles));
});

// Since jQuery is loaded from a CDN, we need to pull it in manually here.
gulp.task('test:copy-jquery', function() {
    return copyBowerFiles('jquery.js', [])
        .pipe(gulp.dest(stat.scripts));
});

// Since cartodb.js is loaded from a CDN, we need to pull it in manually here.
gulp.task('test:copy-cartodb', function() {
    return copyBowerFiles('cartodb.js', [cartoDbRoot + '**/cartodb.js'])
        .pipe(gulp.dest(stat.scripts));
});

gulp.task('test:production', ['test:copy-jquery',
                              'test:copy-cartodb',
                              'minify:vendor-scripts',
                              'minify:scripts'],
    function(done) {
        setTimeout(function() {
            new KarmaServer({
                configFile: __dirname + '/karma/karma.conf.js',
                singleRun: true
            }, done).start();
        }, 6000);
    }
);

gulp.task('test:coverage', ['test:copy-cartodb', 'copy:vendor-scripts', 'copy:scripts'],
    function(done) {
        setTimeout(function() {
            new KarmaServer({
                configFile: __dirname + '/karma/karma-coverage.conf.js',
                singleRun: true
            }, done).start();
        }, 6000);
    }
);

gulp.task('test:development', ['copy:vendor-scripts', 'copy:scripts'],
    function(done) {
        new KarmaServer({
            configFile: __dirname + '/karma/karma-dev.conf.js',
            singleRun: true
        }, done).start();
    }
);

gulp.task('common:build', ['clean'], sequence([
        'copy:vendor-css',
        'copy:vendor-images',
        'copy:marker-images',
        'copy:fontello-fonts',
        'copy:app-images',
        'sass',
        'collectstatic'])
);

gulp.task('test', sequence([
            'production',
            'test:copy-jquery',
            'test:copy-cartodb',
            'minify:scripts',
            'minify:vendor-scripts',
            'test:production',
            'development',
            'copy:vendor-scripts',
            'copy:scripts',
            'test:coverage'])
);

gulp.task('development', ['common:build', 'copy:vendor-scripts', 'copy:scripts']);

gulp.task('production', ['common:build', 'minify:scripts', 'minify:vendor-scripts']);

gulp.task('watch', function () {
    return gulp.watch([
        'app/scripts/**/*.js',
        'app/styles/**/*.css',
        'app/styles/**/*.scss'
    ], ['development']);
});

gulp.task('default', ['production']);
