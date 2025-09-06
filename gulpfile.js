// gulpfile.js
import gulp from 'gulp';
const { series, parallel, watch } = gulp;
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

// Import the new modules.
import { updateFontAwesome } from './build-steps/update-font-awesome.js';
import { updateGoogleFonts } from './build-steps/update-google-fonts.js';
import { lessTask, sassTask } from './build-steps/css-tasks.js';
import { babelTask, browserifyTask } from './build-steps/js-tasks.js';
import { minifyCss, minifyJs } from './build-steps/minify-tasks.js';
import { clean, versionTask, copy, i18n, move, buildRelease, cleanTmp } from './build-steps/utility-tasks.js';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = require('../build-config.js');
const slug = config.slug;

// Change current working directory to plugin root directory.
process.chdir('..');

const args = yargs(hideBin(process.argv)).argv;
const outDir = args.outDir || (args._[0] === 'buildDev' || args._[0] === 'build:dev' ? '.' : 'dist');
const version = args.release || args.v || (args._[0] === 'buildDev' || args._[0] === 'build:dev' ? 'dev' : undefined);

const jsMinSuffix = config.jsMinSuffix;
const verSuffix = version ? `-${version.split('.').slice(0, 3).join('')}` : '';

// CSS task.
const css = parallel(
	config.less && config.less.src && config.less.src.length > 0 ? gulp.series(lessTask.bind(null, config, args)) : (cb) => cb(),
	config.sass && config.sass.src && config.sass.src.length > 0 ? gulp.series(sassTask.bind(null, config, args)) : (cb) => cb()
);

// JS tasks.
const jsTasks = parallel(
	gulp.series(babelTask.bind(null, config, args)),
	gulp.series(browserifyTask.bind(null, config))
);

// Minify tasks.
const minifyTasks = parallel(
	gulp.series(minifyCss.bind(null, config, args)),
	gulp.series(minifyJs.bind(null, config, jsMinSuffix))
);

// Build process.
const buildProcess = series(
	gulp.series(clean.bind(null, outDir)),
	gulp.series(versionTask.bind(null, config, version, jsMinSuffix, verSuffix)),
	parallel(
		css,
		jsTasks
	),
	minifyTasks,
	gulp.series(copy.bind(null, config)),
	gulp.series(i18n.bind(null, config, args)),
	gulp.series(move.bind(null, config, outDir)),
	gulp.series(buildRelease.bind(null, config, outDir, version)),
	cleanTmp  // This now uses the imported cleanTmp from utility-tasks.js.
);

const errorHandler = (err) => {
	console.error('Build failed:', err);
	process.exit(1);
};

export const build = () => buildProcess().catch(errorHandler);

// Build dev task.
const buildDev = (cb) => {
	console.log('Building for development...');

	// Run initial builds.
	const initialBuild = parallel(css, jsTasks);
	initialBuild(() => {
		console.log('Initial build complete. Setting up watchers...');

		// Set up watchers.
		watch(config.less.src, gulp.series(lessTask.bind(null, config, args)));
		watch(config.sass.src, gulp.series(sassTask.bind(null, config, args)));

		if (config.hasOwnProperty('babel')) {
			watch(config.babel.src, gulp.series(babelTask.bind(null, config, args)));
		}

		if (typeof config.browserify !== 'undefined') {
			const browserifyWatch = Array.isArray(config.browserify)
				? config.browserify.flatMap(b => b.watchFiles)
				: config.browserify.watchFiles;
			watch(browserifyWatch, gulp.series(browserifyTask.bind(null, config)));
		}

		cb();
	});
};

// Update Font Awesome task.
export const updateFontAwesomeTask = () => updateFontAwesome(config);

// Update Google Fonts task.
export const updateGoogleFontsTask = () => {
	const args = yargs(hideBin(process.argv)).argv;
	return updateGoogleFonts(config, args.apiKey);
};

// Export tasks with proper bindings.
export const copyWithConfig = copy.bind(null, config);
export const i18nWithConfig = i18n.bind(null, config, args);
export const moveWithConfig = move.bind(null, config, outDir);

export {
	clean,
	versionTask as version,
	css,
	jsTasks as js,
	minifyTasks as minify,
	copyWithConfig as copy,
	i18nWithConfig as i18n,
	moveWithConfig as move,
	buildProcess as buildRelease,
	buildDev
};

// Default task.
export default buildProcess;