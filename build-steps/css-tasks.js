// css-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import less from 'gulp-less';
import sass from 'gulp-sass';

export const lessTask = (config, args) => {
	if (!config.less || !config.less.src || config.less.src.length === 0) {
		console.log('No LESS configuration found or empty source files');
		return Promise.resolve();
	}

	console.log('LESS task starting...');
	console.log('LESS src patterns:', config.less.src);
	
	// Check if this is a release build (has version/release arg) vs dev build
	const isReleaseBuild = args.release || args._[0] === 'buildRelease';
	const outputDir = isReleaseBuild ? 'tmp' : '.';
	const compress = isReleaseBuild;
	
	console.log('LESS output dir:', outputDir);
	console.log('LESS compress:', compress);
	
	return src(config.less.src, { base: '.' })
		.pipe(less({ 
			paths: config.less.include, 
			compress: compress 
		}).on('error', (err) => {
			console.error('LESS compilation error:', err.message);
			// Don't exit in dev mode, just log the error
			if (isReleaseBuild) {
				process.exit(1);
			}
		}))
		.pipe(dest(outputDir));
};

export const sassTask = (config, args) => {
	if (!config.sass || !config.sass.src || config.sass.src.length === 0) {
		console.log('No SASS configuration found or empty source files');
		return Promise.resolve();
	}

	console.log('SASS task starting...');
	console.log('SASS src patterns:', config.sass.src);
	
	// Check if this is a release build (has version/release arg) vs dev build
	const isReleaseBuild = args.release || args._[0] === 'buildRelease';
	const outputDir = isReleaseBuild ? 'tmp' : '.';
	const outputStyle = isReleaseBuild ? 'compressed' : 'nested';
	
	console.log('SASS output dir:', outputDir);
	console.log('SASS output style:', outputStyle);
	
	return src(config.sass.src, { base: '.' })
		.pipe(sass({ 
			includePaths: config.sass.include,
			outputStyle: outputStyle 
		}).on('error', (err) => {
			console.error('SASS compilation error:', err.message);
			// Don't exit in dev mode, just log the error
			if (isReleaseBuild) {
				process.exit(1);
			}
		}))
		.pipe(dest(outputDir));
};