var config = require('../build-config.js'),
    gulp = require('gulp'),
    wpPot = require('gulp-wp-pot'),
    sort = require('gulp-sort'),
    del = require('del'),
    rename = require('gulp-rename'),
    replace = require('gulp-replace'),
    sass = require('gulp-sass'),
    less = require('gulp-less'),
    uglify = require('gulp-uglify'),
    zip = require('gulp-zip'),
    path = require('path');

var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var browserify = require('browserify');


var args = {};
if(process.argv.length > 2) {
    var arr = process.argv.slice(2);
    args.target = arr[0];
    for (var i = 0; i < arr.length; i++) {
        var argName = arr[i];
        if(argName.match(/-\w+/i)) {
            args[argName.slice(1)] = arr[i + 1];
        }
    }
}

//Change current working directory to theme root directory.
process.chdir('..');

var slug = config.slug;
var outDir = args.target == 'build:dev' ? '.' : 'dist';
if( args.target == 'build:dev') args.v = 'dev';

var jsMinSuffix = config.jsMinSuffix;

gulp.task('clean', function () {
    if( outDir != '.') {
        console.log('Deleting output directory: ' + outDir);
        del([outDir]);
    }
});

gulp.task('i18n', ['clean'], function() {
    return gulp.src('**/*.php')
        .pipe(sort())
        .pipe(wpPot( {
            domain: slug,
            destFile: slug + '.pot',
            package: slug,
            bugReport: 'http://www.siteorigin.com',
            lastTranslator: 'SiteOrigin <support@siteorigin.com>',
            team: 'SiteOrigin <support@siteorigin.com>'
        } ))
        .pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : 'languages'));
});

gulp.task('version', ['clean'], function() {
    if(typeof args.v == "undefined") {
        console.log("version task requires version number argument.");
        console.log("E.g. gulp release 1.2.3");
        return;
    }
    return gulp.src(config.version.src)
        .pipe(replace(/(Stable tag:).*/, '$1 '+args.v))
        .pipe(replace(/(Version:).*/, '$1 '+args.v))
        .pipe(replace(/(define\(\s*'[A-Z_]+_VERSION',\s*').*('\s*\);)/, '$1'+args.v+'$2'))
        .pipe(replace(/(define\(\s*'[A-Z_]+_JS_SUFFIX',\s*').*('\s*\);)/, '$1' + jsMinSuffix + '$2'))
        .pipe(gulp.dest('tmp'));
});

gulp.task('less', ['clean'], function(){
    return gulp.src(config.less.src, {base: '.'})
        .pipe(less({paths: config.less.include, compress: args.target == 'build:release'}))
        .pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'));
});

gulp.task('sass', ['clean'], function() {
    if(!config.sass) {
        return;
    }
    return gulp.src(config.sass.src, {base: '.'})
        .pipe(sass({outputStyle: args.target == 'build:release' ? 'compress' : 'nested'}))
        .pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'));
});

gulp.task('css', ['less', 'sass'], function () {

});

gulp.task('concat', ['clean'], function () {

});

gulp.task( 'browserify', [ ], function(){
    if( typeof config.browserify === 'undefined' ) {
        return;
    }

    var b = browserify( config.browserify.src )
        .bundle()
        .on('error', function(e){
            gutil.log( e );
        })
        .pipe(source(config.browserify.fileName))
        .pipe(gulp.dest(config.browserify.dest));

} );

gulp.task('minify', ['concat', 'browserify'], function () {
    return gulp.src(config.js.src, {base: '.'})
        // This will output the non-minified version
        .pipe(gulp.dest('tmp'))
        .pipe(rename({ suffix: jsMinSuffix }))
        .pipe(uglify())
        .pipe(gulp.dest('tmp'));
});

gulp.task('copy', ['version', 'css', 'minify'], function () {
    return gulp.src(config.copy.src, {base: '.'})
        .pipe(gulp.dest('tmp'));
});

gulp.task('move', ['copy'], function () {
    return gulp.src('tmp/**')
        .pipe(gulp.dest(outDir + '/'+slug));
});

gulp.task('build:release', ['move'], function () {
    del(['tmp']);
    var versionNumber = args.hasOwnProperty('v') ? args.v : 'dev';
    return gulp.src(outDir + '/**/*')
        .pipe(zip(slug + '.' + versionNumber + '.zip'))
        .pipe(gulp.dest(outDir));
});

gulp.task('build:dev', [ 'css', 'browserify' ], function () {
    console.log('Watching CSS files...');
    var cssSrc = config.less.src.concat(config.sass.src);
    gulp.watch(cssSrc, ['css']);

    if( typeof config.browserify !== 'undefined' ) {
        console.log('Watching Browserify files...');
        gulp.watch(config.browserify.watchFiles, ['browserify']);
    }
});

gulp.task('default', ['build:release'], function () {

});