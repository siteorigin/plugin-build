// build-steps/minify-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import gulpif from 'gulp-if';
import rename from 'gulp-rename';
import cssnano from 'gulp-cssnano';
import terser from 'gulp-terser';

export const minifyCss = (config, args) => {
	if (!config.css) {
		return Promise.resolve();
	}
	return src(config.css.src, { base: '.' })
		.pipe(gulpif(args.target === 'build:release', dest('tmp')))
		.pipe(rename({ suffix: '.min' }))
		.pipe(cssnano({ zindex: false, reduceIdents: false }))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'));
};

export const minifyJs = (config, jsMinSuffix) => {
	console.log('Starting JS minification...');

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
