// js-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import babel from 'gulp-babel';
import browserify from 'browserify';
import source from 'vinyl-source-stream';

export const babelTask = (config, args) => {
	if (typeof config.babel === 'undefined') {
		console.log('No Babel configuration found');
		return Promise.resolve();
	}

	console.log('Babel task starting...');
	console.log('Babel src patterns:', config.babel.src);
	
	// Check if this is a release build (has version/release arg) vs dev build
	const isReleaseBuild = args.release || args._[0] === 'buildRelease';
	const outputDir = isReleaseBuild ? 'tmp' : '.';
	
	console.log('Babel output dir:', outputDir);
	
	return src(config.babel.src, { base: '.' })
		.on('data', (file) => {
			console.log('Processing Babel file:', file.path);
		})
		.pipe(babel({
			cwd: 'build',
			presets: [
				"@babel/preset-env",
				"@babel/preset-react",
			],
		}).on('error', (err) => {
			console.error('Babel compilation error:', err.message);
			if (isReleaseBuild) {
				process.exit(1);
			}
		}))
		.pipe(dest(outputDir));
};

export const browserifyTask = (config) => {
	if (typeof config.browserify === 'undefined') {
		console.log('No Browserify configuration found');
		return Promise.resolve();
	}

	console.log('Browserify task starting...');
	
	const runBrowserify = (browserifyConfig) => {
		console.log('Processing Browserify bundle:', browserifyConfig.fileName);
		
		return browserify(browserifyConfig.src)
			.bundle()
			.on('error', function(err) {
				console.error('Browserify error:', err.message);
				this.emit('end');
			})
			.pipe(source(browserifyConfig.fileName))
			.pipe(dest(browserifyConfig.dest));
	};

	if (Array.isArray(config.browserify)) {
		console.log('Processing multiple Browserify configurations:', config.browserify.length);
		let browserifyOutput;
		for (let i = 0; i < config.browserify.length; i++) {
			browserifyOutput = runBrowserify(config.browserify[i]);
		}
		return browserifyOutput;
	} else {
		console.log('Processing single Browserify configuration');
		return runBrowserify(config.browserify);
	}
};