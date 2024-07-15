const { src, dest, series, parallel, watch } = require('gulp');
const gulpif = require('gulp-if');
const wpPot = require('gulp-wp-pot');
const sort = require('gulp-sort');
const del = require('del');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const sass = require('gulp-sass')(require('sass'));
const less = require('gulp-less');
const uglify = require('gulp-uglify-es').default;
const cssnano = require('gulp-cssnano');
const zip = require('gulp-zip');
const unzip = require('gulp-unzip');
const chmod = require('gulp-chmod');
const babel = require('gulp-babel');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const gulpFilter = require('gulp-filter');
const moment = require('moment');
const yargs = require('yargs');
const request = require('request');
const fs = require('fs');

const config = require('../build-config.js');

const args = yargs.argv;
const slug = config.slug;
const outDir = args.outDir || (args.target === 'build:dev' ? '.' : 'dist');
const version = args.v || (args.target === 'build:dev' ? 'dev' : undefined);
const jsMinSuffix = config.jsMinSuffix;
const verSuffix = version ? `-${version.split('.').slice(0, 3).join('')}` : '';

// Helper function to catch errors in development
const catchDevErrors = (plugin) => {
	if (args.target === 'build:dev') {
		plugin.on('error', (error) => {
			console.error(error);
			plugin.emit('end');
		});
	}
	return plugin;
};

// Clean task
const clean = () => {
	if (outDir === 'dist') {
		console.log(`Deleting output directory: ${outDir}`);
		return del([outDir]);
	}
	return Promise.resolve();
};

// Version task
const versionTask = () => {
	if (typeof version === "undefined") {
		console.log("version task requires version number argument.");
		console.log("E.g. gulp release --v=1.2.3");
		return Promise.resolve();
	}
	return src(config.version.src)
		.pipe(replace(/(Stable tag:).*/, `$1 ${version}`))
		.pipe(replace(/(Build time:).*/, `$1 ${moment().format()}`))
		.pipe(replace(/(Version:).*/, `$1 ${version}`))
		.pipe(replace(/(define\(\s*'[A-Z_]+_VERSION',\s*').*('\s*\);)/, `$1${version}$2`))
		.pipe(replace(/(define\(\s*'[A-Z_]+_JS_SUFFIX',\s*').*('\s*\);)/, `$1${jsMinSuffix}$2`))
		.pipe(replace(/(define\(\s*'[A-Z_]+_CSS_SUFFIX',\s*').*('\s*\);)/, `$1${jsMinSuffix}$2`))
		.pipe(replace(/(define\(\s*'[A-Z_]+_VERSION_SUFFIX',\s*').*('\s*\);)/, `$1${verSuffix}$2`))
		.pipe(dest('tmp'));
};

// LESS task
const lessTask = () => {
	if (!config.less) {
		return Promise.resolve();
	}
	return src(config.less.src, { base: '.' })
		.pipe(catchDevErrors(less({ paths: config.less.include, compress: args.target === 'build:release' })))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};

// SASS task
const sassTask = () => {
	if (!config.sass) {
		return Promise.resolve();
	}
	return src(config.sass.src, { base: '.' })
		.pipe(catchDevErrors(sass({ outputStyle: args.target === 'build:release' ? 'compressed' : 'nested' })))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};

// CSS task
const css = parallel(lessTask, sassTask);

// Babel task
const babelTask = () => {
	if (typeof config.babel === 'undefined') {
		return Promise.resolve();
	}
	return src(config.babel.src, { base: '.' })
		.pipe(babel({
			presets: ["@babel/preset-env", "@babel/preset-react"],
		}))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};

// Browserify task
const browserifyTask = () => {
	if (typeof config.browserify === 'undefined') {
		return Promise.resolve();
	}

	const runBrowserify = (browserifyConfig) => {
		return browserify(browserifyConfig.src)
			.bundle()
			.on('error', (e) => console.error(e))
			.pipe(source(browserifyConfig.fileName))
			.pipe(dest(browserifyConfig.dest));
	};

	if (Array.isArray(config.browserify)) {
		return Promise.all(config.browserify.map(runBrowserify));
	} else {
		return runBrowserify(config.browserify);
	}
};

// Minify CSS task
const minifyCss = () => {
	if (!config.css) {
		return Promise.resolve();
	}
	return src(config.css.src, { base: '.' })
		.pipe(gulpif(args.target === 'build:release', dest('tmp')))
		.pipe(rename({ suffix: '.min' }))
		.pipe(cssnano({ zindex: false, reduceIdents: false }))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};

// Minify JS task
const minifyJs = () => {
	if (!config.js) {
		return Promise.resolve();
	}
	return src(config.js.src, { base: '.' })
		.pipe(dest('tmp'))
		.pipe(rename({ suffix: jsMinSuffix }))
		.pipe(uglify())
		.pipe(dest('tmp'));
};

// Copy task
const copy = () => {
	if (!config.copy) {
		return Promise.resolve();
	}
	return src(config.copy.src, { base: '.' })
		.pipe(dest('tmp'));
};

// i18n task
const i18n = () => {
	if (!config.i18n) {
		return Promise.resolve();
	}
	const tmpDir = args.target === 'build:release' ? 'tmp/' : '';
	return src(config.i18n.src)
		.pipe(sort())
		.pipe(wpPot({
			domain: slug,
			package: slug,
			bugReport: 'http://www.siteorigin.com/thread',
			lastTranslator: 'SiteOrigin <support@siteorigin.com>',
			team: 'SiteOrigin <support@siteorigin.com>'
		}))
		.pipe(dest(`${tmpDir}lang/${slug}.pot`));
};

// Move task
const move = () => {
	const dest = outDir === 'dist' ? `${outDir}/${slug}` : outDir;
	return src('tmp/**')
		.pipe(dest(dest));
};

// Build release task
const buildRelease = () => {
	const versionNumber = args.hasOwnProperty('v') ? version : 'dev';
	return src(`${outDir}/**/*`)
		.pipe(chmod({
			owner: { read: true, write: true, execute: false },
			group: { read: true, write: false, execute: false },
			others: { read: true, write: false, execute: false }
		}, {
			owner: { read: true, write: true, execute: true },
			group: { read: true, write: false, execute: true },
			others: { read: true, write: false, execute: true }
		}))
		.pipe(gulpif(outDir === 'dist', zip(`${slug}.${versionNumber}.zip`)))
		.pipe(dest(outDir));
};

// Build dev task
const buildDev = () => {
	console.log('Watching LESS files...');
	watch(config.less.src, lessTask);

	console.log('Watching SCSS files...');
	watch(config.sass.src, sassTask);

	if (config.hasOwnProperty('babel')) {
		console.log('Watching JSX files...');
		watch(config.babel.src, babelTask);
	}

	if (typeof config.browserify !== 'undefined') {
		console.log('Watching Browserify files...');
		const browserifyWatch = Array.isArray(config.browserify)
			? config.browserify.flatMap(b => b.watchFiles)
			: config.browserify.watchFiles;
		watch(browserifyWatch, browserifyTask);
	}
};

// Update Google Fonts task
const updateGoogleFonts = (cb) => {
	if (!(config.googleFonts && config.googleFonts.dest)) {
		console.log('Missing googleFonts.dest config value. Need to know where to write the output file.');
		return cb();
	}
	if (!args.apiKey) {
		console.log('Missing apiKey argument. Google Fonts requires an API Key.');
		return cb();
	}

	const outFile = config.googleFonts.dest;
	const fontsUrl = `https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&key=${args.apiKey}`;

	request({
		url: fontsUrl,
		json: true,
	}, (error, response, body) => {
		if (error) {
			console.log('An error occurred while fetching fonts:');
			console.log(error.message);
			return cb(error);
		}

		if (body.error) {
			console.log('An error occurred while fetching fonts:');
			console.log(`${body.error.code.toString()} ${body.error.message}`);
			body.error.errors.forEach(error => console.log(error));
			return cb(new Error('Google Fonts API error'));
		}

		let fontsString = '<?php\n\nreturn array(\n';
		body.items.forEach(font => {
			fontsString += `\t'${font.family}' =>\n\t\tarray(\n`;
			font.variants.forEach((variant, i) => {
				fontsString += `\t\t\t${i} => '${variant}',\n`;
			});
			fontsString += '\t\t),\n';
		});
		fontsString += ');';

		fs.writeFile(outFile, fontsString, error => {
			if (error) {
				console.log(error.message);
				return cb(error);
			}
			console.log('Successfully updated Google Fonts.');
			cb();
		});
	});
};

// Update Font Awesome task
const updateFontAwesome = () => {
	if (!(config.fontAwesome && config.fontAwesome.base)) {
		console.log('Missing fontAwesome.base config value. Need to know where to write the output file.');
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		request('https://github.com/FortAwesome/Font-Awesome/archive/refs/heads/6.x.zip')
			.pipe(fs.createWriteStream('master.zip'))
			.on('finish', () => {
				src('master.zip')
					.pipe(unzip())
					.pipe(dest('tmp'))
					.on('end', () => {
						del(['master.zip']);

						const fontAwesomeTmpDir = 'tmp/Font-Awesome-6.x/';
						const fontAwesome = JSON.parse(fs.readFileSync(`${fontAwesomeTmpDir}metadata/icons.json`));

						let fontsString = '<?php\n\nfunction siteorigin_widgets_icons_fontawesome_filter( $icons ){\n\treturn array_merge($icons, array(\n';
						for (const [icon, iconProps] of Object.entries(fontAwesome)) {
							fontsString += `\t\t'${icon}' => array( 'unicode' => '&#x${iconProps.unicode};', 'styles' => array( `;
							iconProps.styles.forEach((style, i) => {
								fontsString += `${i > 0 ? ", " : ""}'sow-fa${style.charAt(0)}'`;
							});
							fontsString += ' ), ),\n';
						}
						fontsString += '\n\t));\n}\nadd_filter';

						fs.readFile(`${config.fontAwesome.base}filter.php`, 'utf8', (error, data) => {
							if (error) {
								console.log(error.message);
								return reject(error);
							}

							const editedFile = data.replace(/<\?php([\s\S]*?)add_filter/, fontsString);
							fs.writeFile(`${config.fontAwesome.base}filter.php`, editedFile, (error) => {
								if (error) {
									console.log(error.message);
									return reject(error);
								}
								console.log('Successfully updated Font Awesome filter.php. Please manually add migration code for any removed icons. https://fontawesome.com/docs/changelog/');

								fs.readFile(`${fontAwesomeTmpDir}css/regular.css`, 'utf8', (error, data) => {
									if (error) {
										console.log(error.message);
										return reject(error);
									}

									const newVersion = data.match(/Free ([\S]*?) by/);
									fs.readFile(`${config.fontAwesome.base}style.css`, 'utf8', (error, styleData) => {
										if (error) {
											console.log(error.message);
											return reject(error);
										}
										const oldVersion = styleData.match(/Free ([\S]*?) by/);
										const newStyle = styleData.replace(oldVersion[1], newVersion[1]);
										fs.writeFile(`${config.fontAwesome.base}style.css`, newStyle, (error) => {
											if (error) {
												console.log(error.message);
												return reject(error);
											}
											console.log(`Updating Font Awesome ${oldVersion[1]} to ${newVersion[1]}`);

											src(`${fontAwesomeTmpDir}webfonts/*`)
												.pipe(dest(`${config.fontAwesome.base}webfonts`))
												.on('end', () => {
													console.log('Successfully moved Font Awesome font files');
													del(['tmp']);
													resolve();
												});
										});
									});
								});
							});
						});
					});
			});
	});
};

// Exporting tasks
exports.clean = clean;
exports.version = versionTask;
exports.less = lessTask;
exports.sass = sassTask;
