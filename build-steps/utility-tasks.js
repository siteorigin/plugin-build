// build-steps/utility-tasks.js
import gulp from 'gulp';
const { src, dest } = gulp;
import { deleteAsync } from 'del';
import replace from 'gulp-replace';
import moment from 'moment';
import sort from 'gulp-sort';
import wpPot from 'gulp-wp-pot';
import chmod from 'gulp-chmod';
import gulpif from 'gulp-if';
import zip from 'gulp-zip';

export const clean = async (outDir) => {
	if (outDir === 'dist') {
		console.log(`Deleting output directory: ${outDir}`);
		await deleteAsync([outDir]);
	} else {
		console.log(`Not deleting output directory: ${outDir}`);
	}
};

export const versionTask = (config, version, jsMinSuffix, verSuffix) => {
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

export const copy = (config) => {
	if (!config.copy) {
		return Promise.resolve();
	}
	return src(config.copy.src, { base: '.' })
		.pipe(dest('tmp'));
};

export const i18n = (config, args) => {
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

export const move = (config, outDir) => {
	const destDir = outDir === 'dist' ? `${outDir}/${config.slug}` : outDir;
	console.log(`Moving files to ${destDir}...`);
	return src('tmp/**/*', { base: 'tmp' })
		.pipe(dest(destDir));
};

export const buildRelease = (config, outDir, version) => {
	const versionNumber = version || 'dev';
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

export const cleanTmp = () => {
	console.log('Cleaning up tmp directory...');
	return deleteAsync(['tmp']);
};
