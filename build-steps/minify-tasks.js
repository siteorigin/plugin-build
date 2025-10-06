// minify-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import cssnano from 'gulp-cssnano';
import rename from 'gulp-rename';
import terser from 'gulp-terser';
import filter from 'gulp-filter';

export const minifyCss = (config, args) => {
	if (!config.css || !config.css.src || config.css.src.length === 0) {
		console.log('No CSS minification configuration found.');
		return Promise.resolve();
	}

	console.log('CSS minify task starting...');
	console.log('CSS minify src patterns:', config.css.src);
	
	// Check if this is a release build vs dev build.
	const isReleaseBuild = args.release || args._[0] === 'buildRelease';
	const outputDir = isReleaseBuild ? 'tmp' : '.';
	
	console.log('CSS minify output dir:', outputDir);
	
	return src(config.css.src, { base: '.' })
		.on('data', (file) => {
			console.log('Processing CSS minify file:', file.path);
		})
		.pipe(cssnano({
			discardComments: {
				removeAll: true
			}
		}).on('error', (err) => {
			console.error('CSS minification error:', err.message);
			if (isReleaseBuild) {
				process.exit(1);
			}
		}))
		.pipe(rename((path) => {
			path.extname = '.min.css';
		}))
		.pipe(dest(outputDir));
};

export const minifyJs = (config, jsMinSuffix) => {
	if (!config.js || !config.js.src || config.js.src.length === 0) {
		console.log('No JS minification configuration found.');
		return Promise.resolve();
	}

	console.log('JS minify task starting...');
	console.log('JS minify src patterns:', config.js.src);
	console.log('JS minify suffix:', jsMinSuffix);
	
	// Two-step process for JS minification.
	return new Promise((resolve, reject) => {
		console.log('Step 1: Copying original JS files to tmp/');
		
		// First step: Copy original JS files to tmp/.
		const copyOriginals = src(config.js.src, { base: '.' })
			.on('data', (file) => {
				console.log('Copying original JS file:', file.path);
			})
			.pipe(dest('tmp'));
		
		copyOriginals.on('end', () => {
			console.log('Step 2: Creating minified versions');
			
			// Second step: Create minified versions.
			const createMinified = src(config.js.src, { base: '.' })
				.on('data', (file) => {
					console.log('Processing JS minify file:', file.path);
				})
				.pipe(filter('**/*.js'))
				.pipe(terser({
					mangle: true,
					compress: {
						drop_console: false
					}
				}).on('error', (err) => {
					console.error('JS minification error:', err.message);
					reject(err);
				}))
				.pipe(rename((path) => {
					const baseName = path.basename;
					path.basename = baseName + jsMinSuffix;
				}))
				.pipe(dest('tmp'));
			
			createMinified.on('end', () => {
				console.log('JS minification complete.');
				resolve();
			});
			
			createMinified.on('error', reject);
		});
		
		copyOriginals.on('error', reject);
	});
};