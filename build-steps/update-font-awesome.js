// update-font-awesome.js
import gulp from 'gulp';
const { src, dest } = gulp;
import fetch from 'node-fetch';
import unzipper from 'unzipper';
import { promises as fs } from 'fs';
import path from 'path';

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
		const response = await fetch(downloadUrl);
		if (!response.ok) {
			throw new Error(`Download failed: ${response.statusText}`);
		}
		
		const buffer = await response.buffer();
		await fs.writeFile(tempZipPath, buffer);
		console.log('Download complete, extracting...');
		
		// Extract the zip file.
		await fs.mkdir(extractPath, { recursive: true });
		
		return new Promise((resolve, reject) => {
			src(tempZipPath)
				.pipe(unzipper.Extract({ path: extractPath }))
				.on('close', async () => {
					try {
						console.log('Extraction complete, copying files...');
						
						// Copy CSS files.
						if (config.fontAwesome.css && config.fontAwesome.css.dest) {
							await new Promise((resolveCSS, rejectCSS) => {
								src(`${extractPath}/Font-Awesome-${version.replace('v', '')}/css/**/*.css`)
									.on('data', (file) => {
										console.log('Processing FA CSS file:', file.path);
									})
									.pipe(dest(config.fontAwesome.css.dest))
									.on('end', resolveCSS)
									.on('error', rejectCSS);
							});
						}
						
						// Copy font files.
						if (config.fontAwesome.fonts && config.fontAwesome.fonts.dest) {
							await new Promise((resolveFonts, rejectFonts) => {
								src(`${extractPath}/Font-Awesome-${version.replace('v', '')}/fonts/**/*`)
									.on('data', (file) => {
										console.log('Processing FA font file:', file.path);
									})
									.pipe(dest(config.fontAwesome.fonts.dest))
									.on('end', resolveFonts)
									.on('error', rejectFonts);
							});
						}
						
						// Cleanup temp files.
						await fs.unlink(tempZipPath);
						await fs.rmdir(extractPath, { recursive: true });
						
						console.log('Font Awesome update complete.');
						resolve();
					} catch (error) {
						console.error('Font Awesome update error:', error.message);
						reject(error);
					}
				})
				.on('error', reject);
		});
		
	} catch (error) {
		console.error('Font Awesome update error:', error.message);
		throw error;
	}
};