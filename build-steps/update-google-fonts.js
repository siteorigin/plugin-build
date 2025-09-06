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
	
	const outputFile = config.googleFonts.outputFile || 'google-fonts.json';
	const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`;
	
	try {
		console.log('Fetching Google Fonts from API...');
		
		const response = await fetch(apiUrl);
		if (!response.ok) {
			throw new Error(`API request failed: ${response.statusText}`);
		}
		
		const data = await response.json();
		console.log('Google Fonts fetched:', data.items ? data.items.length : 0, 'fonts');
		
		// Process the font data if needed.
		const processedData = {
			kind: data.kind,
			items: data.items.map(font => ({
				family: font.family,
				category: font.category,
				variants: font.variants,
				subsets: font.subsets,
				files: font.files
			}))
		};
		
		// Write to output file.
		const outputPath = path.resolve(outputFile);
		await fs.writeFile(outputPath, JSON.stringify(processedData, null, 2));
		
		console.log('Google Fonts update complete. Written to:', outputPath);
		return processedData;
		
	} catch (error) {
		console.error('Google Fonts update error:', error.message);
		throw error;
	}
};