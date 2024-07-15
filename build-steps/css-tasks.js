// build-steps/css-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import less from 'gulp-less';
import sass from 'gulp-sass';

const catchDevErrors = (plugin) => {
	if (process.env.NODE_ENV === 'development') {
		plugin.on('error', (error) => {
			console.error(error);
			plugin.emit('end');
		});
	}
	return plugin;
};

export const lessTask = (config, args) => {
	if (!config.less) {
		return Promise.resolve();
	}
	return src(config.less.src, { base: '.' })
		.pipe(catchDevErrors(less({ paths: config.less.include, compress: args.target === 'build:release' })))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};

export const sassTask = (config, args) => {
	if (!config.sass || !config.sass.src || config.sass.src.length === 0) {
		console.log('No SASS files to process');
		return Promise.resolve();
	}
	return src(config.sass.src, { base: '.' })
		.pipe(catchDevErrors(sass({ outputStyle: args.target === 'build:release' ? 'compressed' : 'nested' })))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};
