// utility-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import { deleteAsync as del } from 'del';
import replace from 'gulp-replace';
import wpPot from 'gulp-wp-pot';
import zip from 'gulp-zip';
import sort from 'gulp-sort';
import filter from 'gulp-filter';
import moment from 'moment';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

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
		.pipe(replace(/%npm_config_release%/g, version))
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

	// Use Gulp for PHP files (need text processing) and Node.js fs for binary files.
	const phpFiles = src(config.copy.src, { base: '.' })
		.pipe(filter(['**/*.php', '!**/installer/**']))
		.pipe(replace(/(['"])siteorigin-installer-text-domain\1/g, "$1" + config.slug + "$1"))
		.pipe(dest('tmp'));

	// Copy installer PHP files with text domain replacement but preserve formatting.
	const installerPhpFiles = src(config.copy.src, { base: '.' })
		.pipe(filter(['**/installer/**/*.php', '!**/github-plugin-updater.php']))
		.pipe(replace(/(['"])siteorigin-installer-text-domain\1/g, "$1" + config.slug + "$1"))
		.pipe(dest('tmp'));

	// Copy non-PHP files using Node.js fs to preserve binary content.
	const copyBinaryFiles = async () => {
		const allFiles = await glob(config.copy.src, { nodir: true });
		const nonPhpFiles = allFiles.filter(file => !file.endsWith('.php'));
		
		for (const file of nonPhpFiles) {
			const destPath = path.join('tmp', file);
			const destDir = path.dirname(destPath);
			
			// Create destination directory if it doesn't exist.
			if (!fs.existsSync(destDir)) {
				fs.mkdirSync(destDir, { recursive: true });
			}
			
			// Copy file preserving binary content.
			fs.copyFileSync(file, destPath);
		}
	};

	// Wait for all operations to complete.
	return Promise.all([
		new Promise((resolve, reject) => {
			phpFiles.on('end', resolve).on('error', reject);
		}),
		new Promise((resolve, reject) => {
			installerPhpFiles.on('end', resolve).on('error', reject);
		}),
		copyBinaryFiles()
	]);
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
			domain: config.slug,
			package: config.slug,
			bugReport: 'http://www.siteorigin.com/thread',
			lastTranslator: 'SiteOrigin <support@siteorigin.com>',
			team: 'SiteOrigin <support@siteorigin.com>'
		}).on('error', (err) => {
			console.error('POT generation error:', err.message);
		}))
		.pipe(dest(tmpDir + 'lang/' + config.slug + '.pot'));
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