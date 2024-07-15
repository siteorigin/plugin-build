// build-steps/js-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import babel from 'gulp-babel';
import browserify from 'browserify';
import source from 'vinyl-source-stream';

export const babelTask = (config, args) => {
	if (typeof config.babel === 'undefined') {
		return Promise.resolve();
	}
	return src(config.babel.src, { base: '.' })
		.pipe(babel({
			presets: ["@babel/preset-env", "@babel/preset-react"],
		}))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};

export const browserifyTask = (config) => {
	if (typeof config.browserify === 'undefined') {
		return Promise.resolve();
	}

	const runBrowserify = (browserifyConfig) => {
		return browserify(browserifyConfig.src)
			.bundle()
			.on('error', (e) => console.error(e))
			.pipe(source(browserifyConfig.fileName))
			.pipe(dest('tmp'));
	};

	if (Array.isArray(config.browserify)) {
		return Promise.all(config.browserify.map(runBrowserify));
	} else {
		return runBrowserify(config.browserify);
	}
};
