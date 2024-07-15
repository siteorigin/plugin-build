import fetch from 'node-fetch';
import fs from 'fs/promises';
import { src, dest } from 'gulp';
import unzip from 'gulp-unzip';
import { deleteAsync } from 'del';

export const updateFontAwesome = async (config) => {
	if (!(config.fontAwesome && config.fontAwesome.base)) {
		console.log('Missing fontAwesome.base config value. Need to know where to write the output file.');
		return;
	}

	try {
		console.log('Downloading Font Awesome...');
		const response = await fetch('https://github.com/FortAwesome/Font-Awesome/archive/refs/heads/6.x.zip');
		const buffer = await response.buffer();
		await fs.writeFile('master.zip', buffer);

		console.log('Unzipping Font Awesome...');
		await new Promise((resolve, reject) => {
			src('master.zip')
				.pipe(unzip())
				.pipe(dest('tmp'))
				.on('end', resolve)
				.on('error', reject);
		});

		await deleteAsync(['master.zip']);

		const fontAwesomeTmpDir = 'tmp/Font-Awesome-6.x/';
		console.log('Parsing Font Awesome metadata...');
		const fontAwesome = JSON.parse(await fs.readFile(`${fontAwesomeTmpDir}metadata/icons.json`, 'utf8'));

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
		const filterData = await fs.readFile(`${config.fontAwesome.base}filter.php`, 'utf8');
		const editedFile = filterData.replace(/<\?php([\s\S]*?)add_filter/, fontsString);
		await fs.writeFile(`${config.fontAwesome.base}filter.php`, editedFile);

		console.log('Successfully updated Font Awesome filter.php. Please manually add migration code for any removed icons. https://fontawesome.com/docs/changelog/');

		console.log('Updating Font Awesome version...');
		const regularCssData = await fs.readFile(`${fontAwesomeTmpDir}css/regular.css`, 'utf8');
		const newVersion = regularCssData.match(/Free ([\S]*?) by/);
		const styleData = await fs.readFile(`${config.fontAwesome.base}style.css`, 'utf8');
		const oldVersion = styleData.match(/Free ([\S]*?) by/);
		const newStyle = styleData.replace(oldVersion[1], newVersion[1]);
		await fs.writeFile(`${config.fontAwesome.base}style.css`, newStyle);

		console.log(`Updating Font Awesome ${oldVersion[1]} to ${newVersion[1]}`);

		console.log('Moving Font Awesome font files...');
		await new Promise((resolve, reject) => {
			src(`${fontAwesomeTmpDir}webfonts/*`)
				.pipe(dest(`${config.fontAwesome.base}webfonts`))
				.on('end', resolve)
				.on('error', reject);
		});

		console.log('Successfully moved Font Awesome font files');
		await deleteAsync(['tmp']);

		console.log('Font Awesome update completed successfully.');
	} catch (error) {
		console.error('An error occurred while updating Font Awesome:', error);
	}
};
