// utility-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import { deleteAsync as del } from 'del';
import replace from 'gulp-replace';
import wpPot from 'gulp-wp-pot';
import zip from 'gulp-zip';
import sort from 'gulp-sort';
import moment from 'moment';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const clean = async (outDir) => {
	console.log('Cleaning directory:', outDir);
	try {
		const deletedPaths = await del([outDir + '/**', '!' + outDir]);
		console.log('Deleted paths:', deletedPaths.length);
		return deletedPaths;
	} catch (error) {
		console.error('Clean task error:', error.message);
		throw error;
	}
};

export const versionTask = (config, version, jsMinSuffix, verSuffix) => {
	if (!version || version === 'dev') {
		console.log('No version specified or development build, skipping version task.');
		return Promise.resolve();
	}

	console.log('Version task starting...');
	console.log('Version:', version);
	console.log('JS min suffix:', jsMinSuffix);
	console.log('Version suffix:', verSuffix);

	return src(config.version.src, { base: '.' })
		.on('data', (file) => {
			console.log('Processing version file:', file.path);
		})
		.pipe(replace(/(Stable tag:).*/, '$1 ' + version))
		.pipe(replace(/(Build time:).*/, '$1 ' + moment(Date.now()).format()))
		.pipe(replace(/(Version:).*/, '$1 ' + version))
		.pipe(replace(/(define\(\s*'[A-Z_]+_VERSION',\s*').*('\s*\);)/, '$1' + version + '$2'))
		.pipe(replace(/(define\(\s*'[A-Z_]+_JS_SUFFIX',\s*').*('\s*\);)/, '$1' + jsMinSuffix + '$2'))
		.pipe(replace(/(define\(\s*'[A-Z_]+_CSS_SUFFIX',\s*').*('\s*\);)/, '$1' + jsMinSuffix + '$2'))
		.pipe(replace(/(define\(\s*'[A-Z_]+_VERSION_SUFFIX',\s*').*('\s*\);)/, '$1' + verSuffix + '$2'))
		.pipe(dest('tmp'));
};

export const copy = (config) => {
	if (!config.copy || !config.copy.src || config.copy.src.length === 0) {
		console.log('No copy configuration found.');
		return Promise.resolve();
	}

	console.log('Copy task starting...');
	console.log('Copy src patterns:', config.copy.src);

	return src(config.copy.src, { base: '.' })
		.on('data', (file) => {
			console.log('Processing copy file:', file.path);
		})
		.pipe(dest('tmp'));
};

export const i18n = (config, args) => {
	if (!config.pot || !config.pot.src || config.pot.src.length === 0) {
		console.log('No i18n configuration found.');
		return Promise.resolve();
	}

	console.log('i18n task starting...');
	console.log('POT src patterns:', config.pot.src);

	const isReleaseBuild = args.release || args._[0] === 'buildRelease';
	const tmpDir = isReleaseBuild ? 'tmp/' : './';
	
	console.log('POT output dir:', tmpDir);

	return src(config.pot.src)
		.on('data', (file) => {
			console.log('Processing i18n file:', file.path);
		})
		.pipe(sort())
		.pipe(wpPot({
			domain: config.pot.textdomain,
			package: config.pot.package,
			bugReport: config.pot.bugReport,
			lastTranslator: config.pot.lastTranslator,
			team: config.pot.team,
			headers: {
				'poedit': true,
				'x-poedit-keywordslist': true
			}
		}).on('error', (err) => {
			console.error('POT generation error:', err.message);
		}))
		.pipe(dest(`${tmpDir}lang/${config.slug}.pot`));
};

export const move = (config, outDir) => {
	console.log('Move task starting...');
	const dest_path = outDir === 'dist' ? outDir + '/' + config.slug : outDir;
	console.log('Moving tmp/ contents to:', dest_path);

	return src('tmp/**/*')
		.on('data', (file) => {
			console.log('Processing move file:', file.path);
		})
		.pipe(dest(dest_path + '/'));
};

export const buildRelease = (config, outDir, version) => {
	if (!version || version === 'dev') {
		console.log('No version specified for release build, skipping zip creation.');
		return Promise.resolve();
	}

	console.log('Build release task starting...');
	const zipName = `${config.slug}.${version}.zip`;
	
	console.log('Creating zip:', zipName);

	return src(outDir + '/**/*')
		.pipe(zip(zipName))
		.pipe(dest(outDir));
};

export const cleanTmp = async () => {
	console.log('Cleaning tmp directory...');
	try {
		const deletedPaths = await del(['tmp/**']);
		console.log('Cleaned tmp files:', deletedPaths.length);
		return deletedPaths;
	} catch (error) {
		console.error('Clean tmp task error:', error.message);
		throw error;
	}
};