import fetch from 'node-fetch';
import fs from 'fs/promises';

export const updateGoogleFonts = async (config, apiKey) => {
	if (!(config.googleFonts && config.googleFonts.dest)) {
		console.log('Missing googleFonts.dest config value. Need to know where to write the output file.');
		return;
	}
	if (!apiKey) {
		console.log('Missing apiKey argument. Google Fonts requires an API Key.');
		return;
	}

	const outFile = config.googleFonts.dest;
	const fontsUrl = `https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&key=${apiKey}`;

	try {
		const response = await fetch(fontsUrl);
		const body = await response.json();

		if (response.status !== 200) {
			console.log('An error occurred while fetching fonts:');
			console.log(`${body.error.code} ${body.error.message}`);
			body.error.errors.forEach(error => console.log(error));
			throw new Error('Google Fonts API error');
		}

		let fontsString = '<?php\n\nreturn array(\n';
		body.items.forEach(font => {
			fontsString += `\t'${font.family}' =>\n\t\tarray(\n`;
			font.variants.forEach((variant, i) => {
				fontsString += `\t\t\t${i} => '${variant}',\n`;
			});
			fontsString += '\t\t),\n';
		});
		fontsString += ');';

		await fs.writeFile(outFile, fontsString);
		console.log('Successfully updated Google Fonts.');
	} catch (error) {
		console.log('An error occurred while fetching fonts:');
		console.log(error.message);
	}
};
