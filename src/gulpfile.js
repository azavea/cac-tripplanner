/* jshint node:true */
'use strict';

var addsrc = require('gulp-add-src');
var concat = require('gulp-concat');
var debug = require('gulp-debug');
var del = require('del');
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var jshintXMLReporter = require('gulp-jshint-xml-file-reporter');
var karma = require('karma').server;
var mainBower = require('main-bower-files');
var order = require('gulp-order');
var plumber = require('gulp-plumber');
var run = require('gulp-run');
var sequence = require('gulp-sequence');
var shell = require('gulp-shell');
var uglify = require('gulp-uglify');
var watch = require('gulp-watch');
var $ = require('gulp-load-plugins')();

var staticRoot = '/srv/cac';
var pythonRoot = '/opt/app/python/cac_tripplanner';

var stat = {
    scripts: staticRoot + '/scripts',
    styles: staticRoot + '/styles',
    images: staticRoot + '/images'
};

// The multiple-select module needs special treatment, because its bower.json file is incomplete
var multiSelectRoot = 'bower_components/multiple-select';
var awesomeIconsRoot = 'bower_components/Leaflet.awesome-markers/dist/images';

// Define the minification order for our js files
var scriptOrder = [
    // Needs to come first, since it defines the CAC global
    '**/cac.js',

    // Order doesn't matter (yet) for any other files
    '**/*.js'
];

// Helper for copying over bower files
var copyBowerFiles = function(filter, extraFiles) {
    return gulp.src(mainBower())
        .pipe(gulpFilter(filter))
        .pipe(addsrc(extraFiles));
};

gulp.task('collectstatic', function () {
    return run('python ' + pythonRoot + '/manage.py collectstatic --noinput').exec();
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
    return copyBowerFiles('**/*.js', [multiSelectRoot + '/jquery.multiple.select.js'])
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
    return copyBowerFiles('**/*.css', [multiSelectRoot + '/multiple-select.css'])
        .pipe(concat('vendor.css'))
        .pipe(gulp.dest(stat.styles));
});

gulp.task('copy:vendor-images', function() {
    return copyBowerFiles('**/*.png', [multiSelectRoot + '/multiple-select.png'])
        .pipe(gulp.dest(stat.images + '/vendor'));
});

gulp.task('copy:style-images', function() {
    return copyBowerFiles('**/*.png', [awesomeIconsRoot + '/*.png'])
        .pipe(gulp.dest(stat.styles + '/images'));
});

gulp.task('copy:vendor-scripts', function() {
    return copyBowerFiles('**/*.js', [multiSelectRoot + '/jquery.multiple.select.js'])
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
            format: 'jslint_xml',
            filePath: 'coverage/jshint-output.xml'
        }))
        .pipe($.jshint.reporter('fail'));
});

gulp.task('sass', function () {
    return gulp.src('app/styles/main.scss')
        .pipe(plumber())
        .pipe($.rubySass({
            style: 'expanded',
            precision: 10
        }))
        .pipe($.autoprefixer({browsers: ['last 1 version']}))
        .pipe(gulp.dest(stat.styles));
});

// Since jQuery is loaded from a CDN, we need to pull it in manually here.
gulp.task('test:copy-jquery', function() {
    return copyBowerFiles('jquery.js', [])
        .pipe(gulp.dest(stat.scripts));
});

gulp.task('test:production', ['minify:scripts', 'minify:vendor-scripts', 'test:copy-jquery'],
    function(done) {
        setTimeout(function() {
            karma.start({
                configFile: __dirname + '/karma/karma.conf.js'
            }, done);
        }, 500);
    }
);

gulp.task('test:coverage', ['copy:scripts', 'copy:vendor-scripts'],
    function(done) {
        setTimeout(function() {
            karma.start({
                configFile: __dirname + '/karma/karma-coverage.conf.js'
            }, done);
        }, 4000);
    }
);

gulp.task('test:development', ['copy:scripts', 'copy:vendor-scripts'],
    function(done) {
        karma.start({
            configFile: __dirname + '/karma/karma-dev.conf.js'
        }, done);
    }
);

gulp.task('common:build', ['clean'], function() {
    return gulp.start('copy:vendor-css', 'copy:vendor-images', 'copy:style-images', 'sass', 'collectstatic');
});

gulp.task('test', sequence([
            'production',
            'minify:scripts',
            'minify:vendor-scripts',
            'test:copy-jquery',
            'test:production',
            'copy:scripts',
            'copy:vendor-scripts',
            'test:coverage'])
);

gulp.task('development', ['common:build', 'copy:scripts', 'copy:vendor-scripts']);

gulp.task('production', ['common:build', 'minify:scripts', 'minify:vendor-scripts']);

gulp.task('watch', function () {
    return gulp.watch([
        'app/scripts/**/*.js',
        'app/styles/**/*.css',
        'app/styles/**/*.scss'
    ], ['development']);
});

gulp.task('default', ['production']);
