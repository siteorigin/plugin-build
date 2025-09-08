// update-google-fonts.js
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';

export const updateGoogleFonts = async (config, apiKey) => {
	if (!config.googleFonts || !apiKey) {
		console.log('No Google Fonts configuration found or API key missing.');
		return Promise.resolve();
	}

	console.log('Update Google Fonts task starting...');
	console.log('API Key provided:', !!apiKey);

	const outputFile = config.googleFonts.dest || 'base/inc/fonts.php';
	const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`;

	try {
		console.log('Fetching Google Fonts from API...');

		const response = await fetch(apiUrl);
		if (!response.ok) {
			throw new Error(`API request failed: ${response.statusText}`);
		}

		const data = await response.json();
		console.log('Google Fonts fetched:', data.items ? data.items.length : 0, 'fonts');

		// Convert to PHP array format.
		let phpContent = '<?php\n\nreturn array(\n';

		data.items.forEach(font => {
			// Escape single quotes in font family names.
			const escapedFamily = font.family.replace(/'/g, "\\'");
			phpContent += `\t'${escapedFamily}' =>\n\t\tarray(\n`;

			font.variants.forEach((variant, index) => {
				// Convert numeric weights to string format, keep others as-is.
				const weight = variant === '400' ? 'regular' : variant;
				phpContent += `\t\t\t${index} => '${weight}',\n`;
			});

			phpContent += '\t\t),\n';
		});

		phpContent += ');\n';

		// Write to output file.
		const outputPath = path.resolve(outputFile);
		await fs.writeFile(outputPath, phpContent);

		console.log('Google Fonts update complete. Written to:', outputPath);
		return data;

	} catch (error) {
		console.error('Google Fonts update error:', error.message);
		throw error;
	}
};