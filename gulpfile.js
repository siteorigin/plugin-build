var config = require( '../build-config.js' );
var gulp = require( 'gulp' );
var gulpif = require( 'gulp-if' );
var wpPot = require( 'gulp-wp-pot' );
var sort = require( 'gulp-sort' );
var del = require( 'del' );
var rename = require( 'gulp-rename' );
var replace = require( 'gulp-replace' );
var sass = require( 'gulp-sass' );
var less = require( 'gulp-less' );
var uglify = require( 'gulp-uglify-es' ).default;
var cssnano = require( 'gulp-cssnano' );
var zip = require( 'gulp-zip' );
var unzip = require( 'gulp-unzip' );
var chmod = require( 'gulp-chmod' );
var gutil = require( 'gulp-util' );
var source = require( 'vinyl-source-stream' );
var babel = require( 'gulp-babel' );
var browserify = require( 'browserify' );
var gulpFilter = require( 'gulp-filter' );
var moment = require( 'moment' );
var yargs = require( 'yargs' );
var request = require( 'request' );
var fs = require( 'fs' );

var args = yargs.argv;
if ( args.hasOwnProperty( '_' ) ) {
	args.target = args._[ 0 ];
}

var catchDevErrors = function ( plugin ) {
	if ( args.target === 'build:dev' ) {
		plugin.on( 'error', function ( error ) {
			gutil.log( error );
			plugin.emit( 'end' );
		} );
	}
	return plugin;
};

//Change current working directory to plugin root directory.
process.chdir( '..' );

var slug = config.slug;
var outDir = args.outDir || ( args.target === 'build:dev' ? '.' : 'dist' );
var version = args.v;
if ( args.target === 'build:dev' ) version = 'dev';

var jsMinSuffix = config.jsMinSuffix;
var verSuffix = typeof version === 'undefined' ? '' : '-' + version.toString().split( '.' ).splice( 0, 3 ).join( '' );

gulp.task( 'clean', function () {
	if ( outDir === 'dist' ) {
		console.log( 'Deleting output directory: ' + outDir );
		del( [ outDir ] );
	}
} );

gulp.task( 'version', [ 'clean' ], function () {
	if ( typeof version === "undefined" ) {
		console.log( "version task requires version number argument." );
		console.log( "E.g. gulp release 1.2.3" );
		return;
	}
	return gulp.src( config.version.src )
	.pipe( replace( /(Stable tag:).*/, '$1 ' + version ) )
	.pipe( replace( /(Build time:).*/, '$1 ' + moment( Date.now() ).format() ) )
	.pipe( replace( /(Version:).*/, '$1 ' + version ) )
	.pipe( replace( /(define\(\s*'[A-Z_]+_VERSION',\s*').*('\s*\);)/, '$1' + version + '$2' ) )
	.pipe( replace( /(define\(\s*'[A-Z_]+_JS_SUFFIX',\s*').*('\s*\);)/, '$1' + jsMinSuffix + '$2' ) )
	.pipe( replace( /(define\(\s*'[A-Z_]+_CSS_SUFFIX',\s*').*('\s*\);)/, '$1' + jsMinSuffix + '$2' ) )
	.pipe( replace( /(define\(\s*'[A-Z_]+_VERSION_SUFFIX',\s*').*('\s*\);)/, '$1' + verSuffix + '$2' ) )
	.pipe( gulp.dest( 'tmp' ) );
} );

gulp.task( 'less', [], function () {
	if ( !config.less ) {
		return;
	}
	return gulp.src( config.less.src, { base: '.' } )
	.pipe( catchDevErrors( less( { paths: config.less.include, compress: args.target === 'build:release' } ) ) )
	.pipe( gulp.dest( args.target === 'build:release' ? 'tmp' : '.' ) );
} );

gulp.task( 'sass', [], function () {
	if ( !config.sass ) {
		return;
	}
	return gulp.src( config.sass.src, { base: '.' } )
	.pipe( catchDevErrors( sass( { outputStyle: args.target === 'build:release' ? 'compress' : 'nested' } ) ) )
	.pipe( gulp.dest( args.target === 'build:release' ? 'tmp' : '.' ) );
} );

gulp.task( 'css', [ 'less', 'sass' ], function () {

} );

gulp.task( 'babel', function () {
	if ( typeof config.babel === 'undefined' ) {
		return;
	}

	return gulp.src( config.babel.src, { base: '.' } )
		.pipe( babel( {
			cwd: 'build',
			presets: [
				"@babel/preset-env",
				"@babel/preset-react",
			],
		} ) )
		.pipe( gulp.dest( args.target === 'build:release' ? 'tmp' : '.' ) );
} );

gulp.task( 'browserify', [ 'babel' ], function () {
	if ( typeof config.browserify === 'undefined' ) {
		return;
	}

	var runBrowserify = function ( browserifyConfig ) {
		browserify( browserifyConfig.src )
		.bundle()
		.on( 'error', function ( e ) {
			gutil.log( e );
		} )
		.pipe( source( browserifyConfig.fileName ) )
		.pipe( gulp.dest( args.target === 'build:release' ? 'tmp/' + browserifyConfig.dest : browserifyConfig.dest ) );
	};

	if ( Array.isArray( config.browserify ) ) {
		for ( i = 0; i < config.browserify.length; i++ ) {
			runBrowserify( config.browserify[ i ] );
		}
	}
	else {
		runBrowserify( config.browserify );
	}
} );

gulp.task( 'minifyCss', [ 'less', 'sass' ], function () {
	if ( !config.css ) {
		return;
	}
	var cssSrc = config.css.src;
	return gulp.src( cssSrc, { base: '.' } )
	// This will output the non-minified version
	.pipe( gulpif( args.target === 'build:release', gulp.dest( 'tmp' ) ) )
	.pipe( rename( { suffix: '.min' } ) )
	.pipe( cssnano( { zindex: false, reduceIdents: false } ) )
	.pipe( gulp.dest( args.target === 'build:release' ? 'tmp' : '.' ) );
} );

gulp.task( 'minifyJs', [ 'browserify' ], function () {
	if ( !config.js ) {
		return;
	}

	return gulp.src( config.js.src, { base: '.' } )
	.pipe( gulp.dest( 'tmp' ) )
	.pipe( rename( { suffix: jsMinSuffix } ) )
	.pipe( uglify() )
	.pipe( gulp.dest( 'tmp' ) );
} );

gulp.task( 'copy', [ 'version', 'minifyCss', 'minifyJs' ], function () {
	if ( !config.copy ) {
		return;
	}

	return gulp.src( config.copy.src, { base: '.' } )
	.pipe( gulp.dest( 'tmp' ) );
} );

gulp.task( 'i18n', [ 'copy' ], function () {
	if ( !config.i18n ) {
		return;
	}
	var tmpDir = args.target === 'build:release' ? 'tmp/' : '';
	return gulp.src( config.i18n.src )
	.pipe( sort() )
	.pipe( wpPot( {
		domain: slug,
		package: slug,
		bugReport: 'http://www.siteorigin.com/thread',
		lastTranslator: 'SiteOrigin <support@siteorigin.com>',
		team: 'SiteOrigin <support@siteorigin.com>'
	} ) )
	.pipe( gulp.dest( tmpDir + 'lang/' + slug + '.pot' ) );
} );

gulp.task( 'move', [ 'i18n' ], function () {
	var dest = outDir === 'dist' ? outDir + '/' + slug : outDir;
	return gulp.src( 'tmp/**' )
	.pipe( gulp.dest( dest ) );
} );

gulp.task( 'build:release', [ 'clean', 'move' ], function () {
	del( [ 'tmp' ] );
	var versionNumber = args.hasOwnProperty( 'v' ) ? version : 'dev';
	return gulp.src( outDir + '/**/*' )
	// Set folder permissions to 755 and file permissions to 644.
	.pipe( chmod( {
		owner: {
			read: true,
			write: true,
			execute: false,
		},
		group: {
			read: true,
			write: false,
			execute: false,
		},
		others: {
			read: true,
			write: false,
			execute: false,
		},
	}, {
		owner: {
			read: true,
			write: true,
			execute: true,
		},
		group: {
			read: true,
			write: false,
			execute: true,
		},
		others: {
			read: true,
			write: false,
			execute: true,
		},
	} ) )
	.pipe( gulpif( outDir === 'dist', zip( slug + '.' + versionNumber + '.zip' ) ) )
	.pipe( gulp.dest( outDir ) );
} );

gulp.task( 'build:dev', [ 'clean', 'css', 'browserify' ], function () {
	console.log( 'Watching LESS files...' );
	gulp.watch( config.less.src, [ 'less' ] );

	console.log( 'Watching SCSS files...' );
	gulp.watch( config.sass.src, [ 'sass' ] );

	if ( config.hasOwnProperty( 'babel' ) ) {
		console.log( 'Watching JSX files...' );
		gulp.watch( config.babel.src, [ 'babel' ] );
	}

	if ( typeof config.browserify !== 'undefined' ) {
		console.log( 'Watching Browserify files...' );

		var browserifyWatch = [];
		if ( Array.isArray( config.browserify ) ) {
			for ( i = 0; i < config.browserify.length; i++ ) {
				browserifyWatch.push( config.browserify[ i ].watchFiles );
			}
		}
		else {
			browserifyWatch.push( config.browserify.watchFiles );
		}


		gulp.watch( browserifyWatch, [ 'browserify' ] );
	}
} );

gulp.task( 'default', [ 'build:release' ], function () {

} );


gulp.task( 'updateGoogleFonts', function () {
	if ( ! ( config.googleFonts && config.googleFonts.dest ) ) {
		gutil.log( 'Missing googleFonts.dest config value. Need to know where to write the output file.' );
		return;
	}
	console.log(args);
	if ( ! args.apiKey ) {
		gutil.log( 'Missing apiKey argument. Google Fonts requires an API Key.' );
		return;
	}
	
	var outFile = config.googleFonts.dest;
	
	var fontsUrl = 'https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&key=' + args.apiKey;
	
	request( {
		url: fontsUrl,
		json: true,
	}, function ( error, response, body ) {
		
		if ( error ) {
			gutil.log( 'An error occurred while fetching fonts:' );
			gutil.log( error.message );
			return;
		}
		
		if ( body.error ) {
			gutil.log( 'An error occurred while fetching fonts:' );
			gutil.log( body.error.code.toString() + ' ' + body.error.message );
			body.error.errors.forEach( function ( error ) {
				gutil.log( error );
			} );
			return;
		}
		
		var fontsString = '<?php\n\nreturn array(\n';
		var fonts = body.items;
		fonts.forEach( function( font ) {
			fontsString += "\t'" + font.family + "' =>";
			fontsString += "\n\t\tarray(\n";

			font.variants.forEach( function ( variant, i ) {
				fontsString += "\t\t\t" + i + " => '" + variant + "',\n"
			} );
			fontsString += "\t\t),\n";
		} );
		fontsString += ");";
		
		fs.writeFile( outFile, fontsString, function ( error ) {
			if ( error ) {
				gutil.log( error.message );
				throw error;
			}
			gutil.log( 'Successfully updated Google Fonts.' );
		} );
	} );
	
} );

gulp.task( 'updateFontAwesome', function () {
	if ( ! ( config.fontAwesome && config.fontAwesome.base ) ) {
		gutil.log( 'Missing fontAwesome.base config value. Need to know where to write the output file.' );
		return;
	}

	request( 'https://github.com/FortAwesome/Font-Awesome/archive/master.zip' )
	.pipe( fs.createWriteStream( 'master.zip' ) )
	.on( 'finish', function() {
		gulp.src( 'master.zip' )
		.pipe( unzip() )
		.pipe( gulp.dest( 'tmp' ) )
		.on( 'end', function () {
			del( [ 'master.zip' ] );

			const fontAwesomeTmpDir = 'tmp/Font-Awesome-master/';
			const fontAwesome = JSON.parse( fs.readFileSync( fontAwesomeTmpDir + 'metadata/icons.json' ) );

			var fontsString = '<?php\n\nfunction siteorigin_widgets_icons_fontawesome_filter( $icons ){\n\treturn array_merge($icons, array(\n';
			for ( const [ icon, iconProps ] of Object.entries( fontAwesome ) ) {
				fontsString += `\t\t'${icon}' => array( 'unicode' => '&#x${iconProps.unicode};', 'styles' => array( `
				for ( i in iconProps.styles ) {
					fontsString += ( ( i > 0 ) ? ", '" : "'" ) + 'sow-fa' + iconProps.styles[i].charAt(0) + "'";
				}
				fontsString += ' ), ),\n';
			}
			fontsString += '\n\t));\n}\nadd_filter';

			fs.readFile( config.fontAwesome.base + 'filter.php', 'utf8', function( error, data ) {
				if ( error ) {
					console.log( error.message );
					throw error;
				}

				const editedFile = data.replace( /<\?php([\s\S]*?)add_filter/, fontsString );
				fs.writeFile( config.fontAwesome.base + 'filter.php', editedFile, function ( error ) {
					if ( error ) {
						console.log( error.message );
						throw error;
					}
					console.log( 'Successfully updated Font Awesome filter.php. Please manually add migration code for any removed icons. https://github.com/FortAwesome/Font-Awesome/blob/master/UPGRADING.md' );
				} );
			} );

			fs.readFile( fontAwesomeTmpDir + 'css/regular.css', 'utf8', function( error, data ) {
				if ( error ) {
					console.log( error.message );
					throw error;
				}

				const newVersion = data.match( /Free ([\S]*?) by/ );
				fs.readFile( config.fontAwesome.base + 'style.css', 'utf8', function( error, styleData ) {
					if ( error ) {
						console.log( error.message );
						throw error;
					}
					const oldVersion = styleData.match( /Free ([\S]*?) by/ );
					const newStyle = styleData.replace( oldVersion[1], newVersion[1] );
					fs.writeFile( config.fontAwesome.base + 'style.css', newStyle, function ( error ) {
						if ( error ) {
							console.log( error.message );
							throw error;
						}
						console.log( `Updating Font Awesome ${oldVersion[1]} to ${newVersion[1]}` );
					} );
				} );
			} );

			gulp.src( fontAwesomeTmpDir + 'webfonts/*' )
			.pipe( gulp.dest( config.fontAwesome.base + 'webfonts' ) )
			.on( 'end', function () {
				console.log( 'Successfully moved Font Awesome font files' );
				del( [ 'tmp' ] );
			} );

		} );
	} )
} );
