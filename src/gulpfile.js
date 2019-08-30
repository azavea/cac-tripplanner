/* jshint node:true */
'use strict';

var addsrc = require('gulp-add-src');
var aliasify = require('aliasify');
var autoprefixer = require('gulp-autoprefixer');
var browserify = require('browserify');
var concat = require('gulp-concat');
var debug = require('gulp-debug');
var del = require('del');
var exec = require('child_process').exec;
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var jshint = require('gulp-jshint');
var merge = require('merge-stream');
var pump = require('pump');
var sass = require('gulp-sass');
var jshintXMLReporter = require('gulp-jshint-xml-file-reporter');
var KarmaServer = require('karma').Server;
var mainNPM = require('npmfiles');
var order = require('gulp-order');
var plumber = require('gulp-plumber');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var vinylBuffer = require('vinyl-buffer');
var vinylSourceStream = require('vinyl-source-stream');

var uglifyLib = require('uglify-es');
var uglifyComposer = require('gulp-uglify/composer');
var uglify = uglifyComposer(uglifyLib, console);

var pkg = require('./package');
var jshintConfig = pkg.jshintConfig;

jshintConfig.lookup = false;

var staticRoot = '/srv/cac';
var pythonRoot = '/opt/app/python/cac_tripplanner';

var filterCSS = gulpFilter(['**/*.css'], {restore: true});

var stat = {
    fonts: staticRoot + '/fontello',
    scripts: staticRoot + '/scripts',
    styles: staticRoot + '/styles',
    images: staticRoot + '/images'
};

// Define the minification order for our js files
var scriptOrder = [
    // We aren't using an automatic dependency management system,
    // so this needs to be managed manually. This is very error-prone
    // and we should consider moving to something more manageable.
    '**/cac.js',
    '**/utils.js',
    '**/cac/search/cac-search-params.js',
    '**/cac/map/cac-map-templates.js',
    '**/cac/home/cac-home-templates.js',
    '**/cac/control/cac-control-modal.js',
    '**/cac/share/*.js',
    '**/cac/user/*.js',
    '**/cac/search/*.js',
    '**/cac/routing/*.js',
    '**/cac/places/*.js',
    '**/cac/urlrouting/*.js',
    '**/cac/control/cac-control-mode-options.js',
    '**/cac/control/*.js',
    '**/cac/map/*.js',
    '**/cac/home/*.js',
    '**/*.js',
];

// Helper for copying over dependency files
var copyNpmFiles = function() {
    return gulp.src(mainNPM({
        showWarnings: true
    }), {allowEmpty: true, ignore: '**/*gulpfile*'});
};

gulp.task('collectstatic', function (done) {
    exec('python3 ' + pythonRoot + '/manage.py collectstatic --noinput -v0',
        function(err, stdout, stderr) {
            if (stdout) {
                console.log(stdout);
            }
            if (stderr) {
                console.log(stderr);
            }
            done(err);
        });
});

// turf module needs to be run through browserify to pack it with its dependencies
var turfRoot = './node_modules/@turf/';

var buildTurfHelpers = function() {
    return browserify(turfRoot + 'helpers', {
            standalone: 'turf',
            expose: ['helpers']
        })
        .require(turfRoot + 'helpers',
                 {expose: 'turf-helpers'})
        .bundle()
        .pipe(vinylSourceStream('turf-helpers.js'));
};

var buildTurfPointOnLine = function() {
    return browserify(turfRoot + 'nearest-point-on-line', {
            standalone: 'turf.pointOnLine',
            exclude: [turfRoot + 'helpers']
        })
        .transform(aliasify, {aliases: {
            'turf-helpers': turfRoot + 'helpers',
            'turf-distance': turfRoot + 'distance',
            'turf-bearing': turfRoot + 'bearing',
            'turf-destination': turfRoot + 'destination',
            'turf-invariant': turfRoot + 'invariant',
            'turf-line-intersect': turfRoot + 'line-intersect',
            'turf-meta': turfRoot + 'meta'
        }})
        .bundle()
        .pipe(vinylSourceStream('turf-point-on-line.js'));
};

var buildTurfDistance = function() {
    return browserify(turfRoot + 'distance', {
        standalone: 'turf.distance',
        exclude: [turfRoot + 'helpers']
    })
    .transform(aliasify, {aliases: {
        'turf-helpers': turfRoot + 'helpers',
        'turf-invariant': turfRoot + 'invariant'
    }})
    .bundle()
    .pipe(vinylSourceStream('turf-distance.js'));
};

// combine streams from turf and the other vendor dependencies
var copyVendorJS = function() {
    var npmFilesStream = copyNpmFiles();
    var vendorStream = merge(buildTurfHelpers(), buildTurfPointOnLine(), buildTurfDistance());
    vendorStream.add(npmFilesStream);
    // do a global search-and-replace for jQuery's ajax in vendor scripts, to fix
    // running jQuery in noConflict mode for JotForms.
    // (Breaks loading Carto layers when it tries to reference $.ajax.)
    vendorStream.pipe(replace(/\$\.ajax/g, 'jQuery.ajax'));
    return vendorStream;
};

gulp.task('clean', function() {
    return del([
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
        copyVendorJS(),
        vinylBuffer(),
        concat('vendor.js'),
        uglify(),
        gulp.dest(stat.scripts)
    ], cb);
});

gulp.task('copy:scripts', function(cb) {
    pump([
        gulp.src('app/scripts/**/*.js'),
        order(scriptOrder),
        gulp.dest(stat.scripts + '/main')
        ], cb);
});

gulp.task('copy:vendor-css', function(cb) {
    pump([
        gulp.src(['node_modules/leaflet/dist/leaflet.css',
                     'node_modules/leaflet.awesome-markers/dist/leaflet.awesome-markers.css',
                     'node_modules/cartodb.js/dist/cartodb.css',
                     'node_modules/cartodb.js/dist/cartodb.ie.css',
                     'node_modules/tiny-slider/dist/tiny-slider.css',
                     'node_modules/spinkit/css/spinkit.css']),
        concat('vendor.css'),
        autoprefixer({
            cascade: false
        }),
        gulp.dest(stat.styles)
        ], cb);
});

gulp.task('copy:vendor-images', function(cb) {
    pump([
        gulp.src(['**/*.png'], []),
        gulp.dest(stat.images + '/vendor')
        ], cb);
});

gulp.task('copy:marker-images', function(cb) {
    pump([
        gulp.src(['node_modules/*eaflet*/dist/images/*.png']),
        rename({dirname: ''}),
        gulp.dest(stat.styles + '/images')
        ], cb);
});

gulp.task('copy:fontello-fonts', function(cb) {
    pump([
        gulp.src(['app/font/fontello/**']),
        gulp.dest(stat.fonts)
        ], cb);
});

gulp.task('copy:app-images', function(cb) {
    pump([
        gulp.src('app/images/**/*.*'),
        gulp.dest(stat.images)
        ], cb);
});

gulp.task('copy:vendor-scripts', function(cb) {
    pump([
        copyVendorJS(),
        gulp.dest(stat.scripts + '/vendor')
        ], cb);
});

gulp.task('jshint', function (cb) {
    pump([
        gulp.src('app/scripts/cac/**/*.js'),
        jshint(jshintConfig),
        jshint.reporter('jshint-stylish'),
        jshint.reporter('fail')
        ], cb);
});

gulp.task('jshint:jenkins', function () {
    return gulp.src('app/scripts/cac/**/*.js')
        .pipe(jshint(jshintConfig))
        .pipe(jshint.reporter(jshintXMLReporter))
        .on('end', jshintXMLReporter.writeFile({
            alwaysReport: true,
            format: 'jslint',
            filePath: 'coverage/jshint-output.xml'
        }))
        .pipe(jshint.reporter('fail'));
});

gulp.task('sass', function (cb) {
    pump([
        gulp.src('app/styles/main.scss'),
        plumber(),
        sass({outputStyle: 'expanded'}).on('error', sass.logError),
        filterCSS,
        autoprefixer({cascade: false}),
        filterCSS.restore,
        gulp.dest(stat.styles)
        ], cb);
});

gulp.task('test:production', gulp.series(gulp.series(
                              'minify:vendor-scripts',
                              'minify:scripts'),
    function(done) {
        KarmaServer.start({
            configFile: __dirname + '/karma/karma.conf.js',
            singleRun: true
        }, function() {
            done();
        });
    })
);

gulp.task('test:coverage', gulp.series(
    gulp.series('copy:vendor-scripts', 'copy:scripts'),
    function(done) {
        KarmaServer.start({
            configFile: __dirname + '/karma/karma-coverage.conf.js',
            singleRun: true
        }, function() {
            done();
        });
    })
);

gulp.task('test:development', gulp.series(gulp.series('copy:vendor-scripts', 'copy:scripts'),
    function(done) {
        KarmaServer.start({
            configFile: __dirname + '/karma/karma-dev.conf.js',
            singleRun: true
        }, function() {
            done();
        });
    })
);

gulp.task('common:build', gulp.series(
    'clean',
    'copy:fontello-fonts',
    'copy:vendor-css',
    'copy:vendor-images',
    'copy:marker-images',
    'copy:app-images',
    'sass',
    'collectstatic')
);

gulp.task('development', gulp.series('common:build', 'copy:vendor-scripts', 'copy:scripts'));

gulp.task('production', gulp.series('common:build', 'minify:scripts', 'minify:vendor-scripts'));

gulp.task('test', gulp.series(
    'production',
    'test:production',
    'development',
    'test:coverage')
);

gulp.task('watch', function () {
    return gulp.watch([
        'app/scripts/**/*.js',
        'app/styles/**/*.css',
        'app/styles/**/*.scss'
    ], gulp.series('development'));
});

gulp.task('default', gulp.series('development'));
