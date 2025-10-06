// update-font-awesome.js
import gulp from 'gulp';
const { src, dest } = gulp;
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { Extract } from 'unzipper';

export const updateFontAwesome = async (config) => {
	if (!config.fontAwesome || !config.fontAwesome.version) {
		console.log('No Font Awesome configuration found.');
		return Promise.resolve();
	}

	console.log('Update Font Awesome task starting...');
	console.log('Font Awesome version:', config.fontAwesome.version);
	
	const version = config.fontAwesome.version;
	const downloadUrl = `https://github.com/FortAwesome/Font-Awesome/archive/refs/tags/${version}.zip`;
	const tempZipPath = path.resolve('tmp-fa.zip');
	const extractPath = path.resolve('tmp-fa-extract');
	
	try {
		console.log('Downloading Font Awesome from:', downloadUrl);
		
		// Download the zip file.
		const response = await fetch(downloadUrl, { redirect: 'follow' });
		if (!response.ok) {
			throw new Error(`Download failed: ${response.statusText}`);
		}
		
		const buffer = await response.buffer();
		await fs.writeFile(tempZipPath, buffer);
		console.log('Download complete, extracting...');
		
		// Extract the zip file.
		await fs.mkdir(extractPath, { recursive: true });
		
		// Extract using Node.js streams to avoid Gulp binary issues.
		await new Promise((resolve, reject) => {
			createReadStream(tempZipPath)
				.pipe(Extract({ path: extractPath }))
				.on('close', resolve)
				.on('error', reject);
		});
		
		console.log('Extraction complete, copying files...');
		
		// Copy CSS files.
		if (config.fontAwesome.css && config.fontAwesome.css.dest) {
			await new Promise((resolveCSS, rejectCSS) => {
				src(`${extractPath}/Font-Awesome-${version}/css/**/*.css`)
					.on('data', (file) => {
						console.log('Processing FA CSS file:', file.path);
					})
					.pipe(dest(config.fontAwesome.css.dest))
					.on('end', resolveCSS)
					.on('error', rejectCSS);
			});
		}

		// Copy font files using Node.js fs to preserve binary content.
		if (config.fontAwesome.fonts && config.fontAwesome.fonts.dest) {
			const glob = (await import('glob')).glob;
			const fontFiles = await glob(`${extractPath}/Font-Awesome-${version}/webfonts/**/*`, { nodir: true });

			for (const file of fontFiles) {
				const relativePath = path.relative(`${extractPath}/Font-Awesome-${version}/webfonts`, file);
				const destPath = path.join(config.fontAwesome.fonts.dest, relativePath);
				const destDir = path.dirname(destPath);

				console.log('Processing FA font file:', file);

				if (!await fs.access(destDir).then(() => true).catch(() => false)) {
					await fs.mkdir(destDir, { recursive: true });
				}

				await fs.copyFile(file, destPath);
			}
		}

		// Cleanup temp files.
		await fs.unlink(tempZipPath);
		await fs.rm(extractPath, { recursive: true });

		console.log('Font Awesome update complete.');
		
	} catch (error) {
		console.error('Font Awesome update error:', error.message);
		throw error;
	}
};