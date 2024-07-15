import gulp from 'gulp';
const { src, dest, series, parallel, watch } = gulp;
import gulpif from 'gulp-if';
import wpPot from 'gulp-wp-pot';
import sort from 'gulp-sort';
import { deleteAsync } from 'del';
import rename from 'gulp-rename';
import replace from 'gulp-replace';
import sass from 'gulp-sass';
import less from 'gulp-less';
import terser from 'gulp-terser';
import cssnano from 'gulp-cssnano';
import zip from 'gulp-zip';
import unzip from 'gulp-unzip';
import chmod from 'gulp-chmod';
import babel from 'gulp-babel';
import browserify from 'browserify';
import source from 'vinyl-source-stream';
import gulpFilter from 'gulp-filter';
import moment from 'moment';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = require('../build-config.js');
const slug = config.slug; // Add this line

// Change current working directory to plugin root directory
process.chdir('..');

const args = yargs(hideBin(process.argv)).argv;
const outDir = args.outDir || (args._[0] === 'buildDev' ? '.' : 'dist');
const version = args.release || (args._[0] === 'buildDev' ? 'dev' : undefined);

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
const clean = async () => {
	if (outDir === 'dist') {
		console.log(`Deleting output directory: ${outDir}`);
		await deleteAsync([outDir]);
	} else {
		console.log(`Not deleting output directory: ${outDir}`);
	}
};

// Version task
const versionTask = () => {
	if (typeof version === "undefined") {
		console.log("version task requires version number argument.");
		console.log("E.g. gulp release --release=1.2.3");
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
	if (!config.sass || !config.sass.src || config.sass.src.length === 0) {
		console.log('No SASS files to process');
		return Promise.resolve();
	}
	return src(config.sass.src, { base: '.' })
		.pipe(catchDevErrors(sass({ outputStyle: args.target === 'build:release' ? 'compressed' : 'nested' })))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};

// CSS task
const css = parallel(
	config.less && config.less.src && config.less.src.length > 0 ? lessTask : (cb) => cb(),
	config.sass && config.sass.src && config.sass.src.length > 0 ? sassTask : (cb) => cb()
);

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
			.pipe(dest('tmp')); // Output directly to the tmp directory
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
	console.log('Starting JS minification...');

	// Combine regular JS and browserified JS
	const jsFiles = [
		...(config.js && config.js.src ? config.js.src : []),
		'tmp/**/*.js'
	];

	return src(jsFiles, { base: '.' })
		.pipe(gulpif(file => !file.path.includes('.min.js'), rename({ suffix: jsMinSuffix })))
		.pipe(terser().on('error', (err) => {
			console.error('Terser error:', err.toString());
			this.emit('end');
		}))
		.pipe(dest('tmp'))
		.on('end', () => console.log('JS minification completed.'));
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
	if (!config.i18n || !config.slug) {
		console.log('Missing i18n configuration or slug');
		return Promise.resolve();
	}
	const tmpDir = args.target === 'build:release' ? 'tmp/' : '';
	return src(config.i18n.src)
		.pipe(sort())
		.pipe(wpPot({
			domain: config.slug,
			package: config.slug,
			bugReport: 'http://www.siteorigin.com/thread',
			lastTranslator: 'SiteOrigin <support@siteorigin.com>',
			team: 'SiteOrigin <support@siteorigin.com>'
		}))
		.pipe(dest(`${tmpDir}lang/${config.slug}.pot`));
};

// Move task
const move = () => {
	const destDir = outDir === 'dist' ? `${outDir}/${config.slug}` : outDir;
	console.log(`Moving files to ${destDir}...`);
	return src('tmp/**/*', { base: 'tmp' })
		.pipe(dest(destDir));
};

// Build release task
const buildRelease = () => {
	const versionNumber = args.hasOwnProperty('release') ? version : 'dev';
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
		.pipe(gulpif(outDir === 'dist', zip(`${config.slug}.${versionNumber}.zip`)))
		.pipe(dest(outDir));
};

// Build dev task
const buildDev = (cb) => {
	console.log('Building for development...');

	// Run initial builds
	const initialBuild = parallel(css, babelTask, browserifyTask);
	initialBuild(() => {
		console.log('Initial build complete. Setting up watchers...');

		// Set up watchers
		watch(config.less.src, lessTask);
		watch(config.sass.src, sassTask);

		if (config.hasOwnProperty('babel')) {
			watch(config.babel.src, babelTask);
		}

		if (typeof config.browserify !== 'undefined') {
			const browserifyWatch = Array.isArray(config.browserify)
				? config.browserify.flatMap(b => b.watchFiles)
				: config.browserify.watchFiles;
			watch(browserifyWatch, browserifyTask);
		}

		cb();
	});
};

// Update Google Fonts task
const updateGoogleFonts = async () => {
	if (!(config.googleFonts && config.googleFonts.dest)) {
		console.log('Missing googleFonts.dest config value. Need to know where to write the output file.');
		return;
	}
	if (!args.apiKey) {
		console.log('Missing apiKey argument. Google Fonts requires an API Key.');
		return;
	}

	const outFile = config.googleFonts.dest;
	const fontsUrl = `https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&key=${args.apiKey}`;

	try {
		const response = await fetch(fontsUrl);
		const body = await response.json();

		if (response.status !== 200) {
			console.log('An error occurred while fetching fonts:');
			console.log(`${body.error.code} ${body.error.message}`);
			body.error.errors.forEach(error => console.log(error));
			throw new Error('Google Fonts API error');
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

		await fs.promises.writeFile(outFile, fontsString);
		console.log('Successfully updated Google Fonts.');
	} catch (error) {
		console.log('An error occurred while fetching fonts:');
		console.log(error.message);
	}
};

// Update Font Awesome task
const updateFontAwesome = async () => {
	if (!(config.fontAwesome && config.fontAwesome.base)) {
		console.log('Missing fontAwesome.base config value. Need to know where to write the output file.');
		return;
	}

	try {
		console.log('Downloading Font Awesome...');
		const response = await fetch('https://github.com/FortAwesome/Font-Awesome/archive/refs/heads/6.x.zip');
		const buffer = await response.buffer();
		await fs.writeFile('master.zip', buffer);

		console.log('Unzipping Font Awesome...');
		await new Promise((resolve, reject) => {
			src('master.zip')
				.pipe(unzip())
				.pipe(dest('tmp'))
				.on('end', resolve)
				.on('error', reject);
		});

		await deleteAsync(['master.zip']);

		const fontAwesomeTmpDir = 'tmp/Font-Awesome-6.x/';
		console.log('Parsing Font Awesome metadata...');
		const fontAwesome = JSON.parse(await fs.readFile(`${fontAwesomeTmpDir}metadata/icons.json`, 'utf8'));

		let fontsString = '<?php\n\nfunction siteorigin_widgets_icons_fontawesome_filter( $icons ){\n\treturn array_merge($icons, array(\n';
		for (const [icon, iconProps] of Object.entries(fontAwesome)) {
			fontsString += `\t\t'${icon}' => array( 'unicode' => '&#x${iconProps.unicode};', 'styles' => array( `;
			iconProps.styles.forEach((style, i) => {
				fontsString += `${i > 0 ? ", " : ""}'sow-fa${style.charAt(0)}'`;
			});
			fontsString += ' ), ),\n';
		}
		fontsString += '\n\t));\n}\nadd_filter';

		console.log('Updating Font Awesome filter...');
		const filterData = await fs.readFile(`${config.fontAwesome.base}filter.php`, 'utf8');
		const editedFile = filterData.replace(/<\?php([\s\S]*?)add_filter/, fontsString);
		await fs.writeFile(`${config.fontAwesome.base}filter.php`, editedFile);

		console.log('Successfully updated Font Awesome filter.php. Please manually add migration code for any removed icons. https://fontawesome.com/docs/changelog/');

		console.log('Updating Font Awesome version...');
		const regularCssData = await fs.readFile(`${fontAwesomeTmpDir}css/regular.css`, 'utf8');
		const newVersion = regularCssData.match(/Free ([\S]*?) by/);
		const styleData = await fs.readFile(`${config.fontAwesome.base}style.css`, 'utf8');
		const oldVersion = styleData.match(/Free ([\S]*?) by/);
		const newStyle = styleData.replace(oldVersion[1], newVersion[1]);
		await fs.writeFile(`${config.fontAwesome.base}style.css`, newStyle);

		console.log(`Updating Font Awesome ${oldVersion[1]} to ${newVersion[1]}`);

		console.log('Moving Font Awesome font files...');
		await new Promise((resolve, reject) => {
			src(`${fontAwesomeTmpDir}webfonts/*`)
				.pipe(dest(`${config.fontAwesome.base}webfonts`))
				.on('end', resolve)
				.on('error', reject);
		});

		console.log('Successfully moved Font Awesome font files');
		await deleteAsync(['tmp']);

		console.log('Font Awesome update completed successfully.');
	} catch (error) {
		console.error('An error occurred while updating Font Awesome:', error);
	}
};

// Define the series of tasks for the build process
const buildProcess = series(
	clean,
	versionTask,
	parallel(
		css,
		series(babelTask, browserifyTask)
	),
	parallel(minifyCss, minifyJs),
	copy,
	i18n,
	move,
	buildRelease
);

const errorHandler = (err) => {
	console.error('Build failed:', err);
	process.exit(1);
};

export const build = () => buildProcess().catch(errorHandler);

// Define js and minify tasks separately
const jsTasks = parallel(babelTask, browserifyTask);
const minifyTasks = parallel(minifyCss, minifyJs);

// Export tasks
export {
	clean,
	versionTask as version,
	css,
	jsTasks as js,
	minifyTasks as minify,
	copy,
	i18n,
	move,
	buildProcess as buildRelease,
	buildDev,
	updateGoogleFonts,
	updateFontAwesome
};

// Default task
export default buildProcess;
