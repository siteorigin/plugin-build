import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { src, dest } from 'gulp';
import { deleteAsync } from 'del';
import { promisify } from 'util';
import stream from 'stream';
import { createWriteStream } from 'fs';
import unzipper from 'unzipper';

const pipeline = promisify(stream.pipeline);

export const updateFontAwesome = async (config) => {
	if (!(config.fontAwesome && config.fontAwesome.base)) {
		console.log('Missing fontAwesome.base config value. Need to know where to write the output file.');
		return;
	}

	const tmpDir = path.join(process.cwd(), 'tmp');
	const zipFilePath = path.join(tmpDir, 'fontawesome.zip');
	const extractDir = path.join(tmpDir, 'fontawesome-extract');
	const fontAwesomeTmpDir = path.join(extractDir, 'Font-Awesome-6.x');

	try {
		// Create tmp directory
		await fs.mkdir(tmpDir, { recursive: true });
		await fs.mkdir(extractDir, { recursive: true });

		console.log('Downloading Font Awesome...');
		const response = await fetch('https://github.com/FortAwesome/Font-Awesome/archive/refs/heads/6.x.zip');

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		await pipeline(response.body, createWriteStream(zipFilePath));

		console.log('Verifying downloaded file...');
		const stats = await fs.stat(zipFilePath);
		if (stats.size === 0) {
			throw new Error('Downloaded file is empty');
		}

		console.log('Unzipping Font Awesome...');
		await fs.createReadStream(zipFilePath)
			.pipe(unzipper.Extract({ path: extractDir }))
			.promise();

		console.log('Parsing Font Awesome metadata...');
		const fontAwesome = JSON.parse(await fs.readFile(path.join(fontAwesomeTmpDir, 'metadata', 'icons.json'), 'utf8'));

		let fontsString = '<?php\n\nfunction siteorigin_widgets_icons_fontawesome_filter( $icons ){\n\treturn array_merge($icons, array(\n';
		for (const [icon, iconProps] of Object.entries(fontAwesome)) {
			fontsString += `\t\t'${icon}' => array( 'unicode' => '&#x${iconProps.unicode};', 'styles' => array( `;
			iconProps.styles.forEach((style, i) => {
				fontsString += `${i > 0 ? ", " : ""}'sow-fa${style.charAt(0)}'`;
			});
			fontsString += ' ), ),\n';
		}
		fontsString += '\n\t));\n}\nadd_filter';

		console.log('Updating Font Awesome filter...');
		const filterPath = path.join(config.fontAwesome.base, 'filter.php');
		const filterData = await fs.readFile(filterPath, 'utf8');
		const editedFile = filterData.replace(/<\?php([\s\S]*?)add_filter/, fontsString);
		await fs.writeFile(filterPath, editedFile);

		console.log('Successfully updated Font Awesome filter.php. Please manually add migration code for any removed icons. https://fontawesome.com/docs/changelog/');

		console.log('Updating Font Awesome version...');
		const regularCssPath = path.join(fontAwesomeTmpDir, 'css', 'regular.css');
		const regularCssData = await fs.readFile(regularCssPath, 'utf8');
		const newVersion = regularCssData.match(/Free ([\S]*?) by/);
		const stylePath = path.join(config.fontAwesome.base, 'style.css');
		const styleData = await fs.readFile(stylePath, 'utf8');
		const oldVersion = styleData.match(/Free ([\S]*?) by/);
		const newStyle = styleData.replace(oldVersion[1], newVersion[1]);
		await fs.writeFile(stylePath, newStyle);

		console.log(`Updating Font Awesome ${oldVersion[1]} to ${newVersion[1]}`);

		console.log('Moving Font Awesome font files...');
		await new Promise((resolve, reject) => {
			src(path.join(fontAwesomeTmpDir, 'webfonts', '*'))
				.pipe(dest(path.join(config.fontAwesome.base, 'webfonts')))
				.on('end', resolve)
				.on('error', reject);
		});

		console.log('Successfully moved Font Awesome font files');
		console.log('Font Awesome update completed successfully.');
	} catch (error) {
		console.error('An error occurred while updating Font Awesome:', error);
	} finally {
		// Clean up temporary files
		await deleteAsync([tmpDir]);
	}
};
