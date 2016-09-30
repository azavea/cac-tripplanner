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
var merge = require('merge-stream');
var sass = require('gulp-sass');
var jshintXMLReporter = require('gulp-jshint-xml-file-reporter');
var karma = require('karma').server;
var mainBower = require('main-bower-files');
var order = require('gulp-order');
var plumber = require('gulp-plumber');
var run = require('gulp-run');
var sequence = require('gulp-sequence');
var shell = require('gulp-shell');
var uglify = require('gulp-uglify');
var vinylSourceStream = require('vinyl-source-stream');
var watch = require('gulp-watch');
var $ = require('gulp-load-plugins')();

var staticRoot = '/srv/cac';
var pythonRoot = '/opt/app/python/cac_tripplanner';

var filterCSS = gulpFilter('**/*.css');

var stat = {
    fonts: staticRoot + '/fonts',
    scripts: staticRoot + '/scripts',
    styles: staticRoot + '/styles',
    images: staticRoot + '/images'
};

var bootstrapSelectRoot = 'bower_components/bootstrap-select/dist/';
var awesomeIconsRoot = 'bower_components/Leaflet.awesome-markers/dist/images';
var materialIconsRoot = 'bower_components/material-design-iconic-font/svg/maps';
var cartoDbRoot = 'bower_components/cartodb.js/src/';

// Define the minification order for our js files
var scriptOrder = [
    // We aren't using an automatic dependency management system,
    // so this needs to be managed manually. This is very error-prone
    // and we should consider moving to something more manageable.
    '**/cac.js',
    '**/utils.js',
    '**/cac/search/cac-search-params.js',
    '**/cac/map/cac-map-templates.js',
    '**/cac/share/*.js',
    '**/cac/user/*.js',
    '**/cac/search/*.js',
    '**/cac/routing/*.js',
    '**/cac/urlrouting/*.js',
    '**/cac/control/*.js',
    '**/cac/map/*.js',
    '**/cac/home/*.js',
    '**/*.js'
];

// Helper for copying over bower files
var copyBowerFiles = function(filter, extraFiles) {
    return gulp.src(mainBower())
        .pipe(gulpFilter(filter))
        .pipe(addsrc(extraFiles));
};

// turf module needs to be run through browserify to pack it with its dependencies

var buildTurfHelpers = function() {
    return browserify('./node_modules/@turf/point-on-line/node_modules/@turf/helpers', {
            standalone: 'turf',
            expose: ['helpers']
        })
        .require('./node_modules/@turf/point-on-line/node_modules/@turf/helpers',
                 {expose: 'turf-helpers'})
        .bundle()
        .pipe(vinylSourceStream('turf-helpers.js'));
};

var buildTurfPointOnLine = function() {
    return browserify('./node_modules/@turf/point-on-line', {
            standalone: 'turf.pointOnLine',
            exclude: ['./node_modules/@turf/point-on-line/node_modules/@turf/helpers']
        })
        .transform(aliasify, {aliases: {
            'turf-helpers': './node_modules/@turf/point-on-line/node_modules/@turf/helpers',
            'turf-distance': './node_modules/@turf/point-on-line/node_modules/@turf/distance',
            'turf-bearing': './node_modules/@turf/point-on-line/node_modules/@turf/bearing',
            'turf-destination': './node_modules/@turf/point-on-line/node_modules/@turf/destination'
        }})
        .bundle()
        .pipe(vinylSourceStream('turf-point-on-line.js'));
};

// combine streams from turf and the other vendor dependencies
var copyVendorJS = function(filter, extraFiles) {
    var bowerStream = copyBowerFiles(filter, extraFiles);
    var vendorStream = merge(buildTurfHelpers(), buildTurfPointOnLine());
    vendorStream.add(bowerStream);
    return vendorStream;
};

// silence the collectstatic output
// gulp-run hangs if the output is too large:
// https://github.com/MrBoolean/gulp-run/issues/34
gulp.task('collectstatic', function () {
    return run('python ' + pythonRoot + '/manage.py collectstatic --noinput -v0').exec();
});

gulp.task('clean', function() {
    // This must be done synchronously to prevent sporadic failures
    return del.sync([
        stat.styles + '/**',
        stat.scripts + '/**',
        stat.images + '/**'
    ], { force: true });
});

gulp.task('minify:scripts', function() {
    return gulp.src('app/scripts/**/*.js')
        .pipe(order(scriptOrder))
        .pipe(concat('main.js'))
        .pipe(uglify())
        .pipe(gulp.dest(stat.scripts));
});

gulp.task('minify:vendor-scripts', function() {
    return copyVendorJS(['**/*.js',
                        // Exclude minified vendor scripts that also have a non-minified version.
                        // We run our own minifier, and want to include each script only once.
                        '!**/lodash.min.js', '!**/bootstrap-datetimepicker.min.js',
                        // exclude leaflet and jquery (loaded over CDN)
                        '!**/leaflet.js', '!**/leaflet-src.js', '!**/jquery.js', '!**/jquery.min.js'],
                        [])
        .pipe(concat('vendor.js'))
        .pipe(uglify())
        .pipe(gulp.dest(stat.scripts));
});

gulp.task('copy:scripts', function() {
    return gulp.src('app/scripts/**/*.js')
        .pipe(order(scriptOrder))
        .pipe(gulp.dest(stat.scripts + '/main'));
});

gulp.task('copy:vendor-css', function() {
    return copyBowerFiles('**/*.css', [bootstrapSelectRoot + 'css/bootstrap-select.css'])
        .pipe(concat('vendor.css'))
        .pipe($.autoprefixer({
            browsers: ['last 2 versions'],
            cascade: false
        }))
        .pipe(gulp.dest(stat.styles));
});

gulp.task('copy:bootstrap-select-map', function() {
    return copyBowerFiles('**.*.map', [bootstrapSelectRoot + 'css/bootstrap-select.css.map'])
        .pipe(concat('bootstrap-select.css.map'))
        .pipe(gulp.dest(stat.styles));
});

gulp.task('copy:vendor-images', function() {
    return copyBowerFiles('**/*.png', [])
        .pipe(gulp.dest(stat.images + '/vendor'));
});

gulp.task('copy:fa-images', function() {
    return copyBowerFiles('**/*.png', [awesomeIconsRoot + '/*.png'])
        .pipe(gulp.dest(stat.styles + '/images'));
});

gulp.task('copy:md-images', function() {
    return copyBowerFiles('**/*.svg', [materialIconsRoot + '/*.svg'])
        .pipe(gulp.dest(stat.styles + '/images'));
});

gulp.task('copy:md-fonts', function() {
    return copyBowerFiles('**/*.{woff,tiff,svg,eot}', [materialIconsRoot + '/*.{woff,tiff,svg,eot}'])
        .pipe(gulp.dest(stat.fonts));
});

gulp.task('copy:app-images', function() {
    return gulp.src('app/images/**/*.*')
        .pipe(gulp.dest(stat.images));
});

gulp.task('copy:vendor-scripts', function() {
    return copyVendorJS(['**/*.js',
                        // exclude leaflet
                        '!**/leaflet.js', '!**/leaflet-src.js'],
                        [])
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
        .pipe(filterCSS.restore())
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

gulp.task('test:production', ['minify:scripts',
                              'minify:vendor-scripts',
                              'test:copy-jquery',
                              'test:copy-cartodb'],
    function(done) {
        setTimeout(function() {
            karma.start({
                configFile: __dirname + '/karma/karma.conf.js'
            }, done);
        }, 1000);
    }
);

gulp.task('test:coverage', ['copy:vendor-scripts', 'copy:scripts', 'test:copy-cartodb'],
    function(done) {
        setTimeout(function() {
            karma.start({
                configFile: __dirname + '/karma/karma-coverage.conf.js'
            }, done);
        }, 6000);
    }
);

gulp.task('test:development', ['copy:vendor-scripts', 'copy:scripts'],
    function(done) {
        karma.start({
            configFile: __dirname + '/karma/karma-dev.conf.js'
        }, done);
    }
);

gulp.task('common:build', ['clean'], function() {
    return gulp.start(
        'copy:vendor-css',
        'copy:bootstrap-select-map',
        'copy:vendor-images',
        'copy:fa-images',
        'copy:md-images',
        'copy:md-fonts',
        'copy:app-images',
        'sass',
        'collectstatic');
});

gulp.task('test', sequence([
            'production',
            'minify:scripts',
            'minify:vendor-scripts',
            'test:copy-jquery',
            'test:copy-cartodb',
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
