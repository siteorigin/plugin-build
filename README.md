# Building SiteOrigin plugins
There are few steps necessary to prepare a plugin for release on the WordPress.org plugin directory. We use [Gulp 5](http://gulpjs.com/) to automate this.

## Environment setup
1. [Download](https://nodejs.org/download/) and install Node.js and npm (Node.js 18+ required for Gulp 5).
2. Install Gulp CLI using `npm install -g gulp-cli`.
3. In the plugin folder, ensure the plugin-build repository has been added as a submodule in a folder called 'build' and is up to date. This can be done using `git submodule add git@github.com:siteorigin/plugin-build.git build`. 
4. In a terminal, navigate to the build directory in the plugin and run `npm install`. When using plugin-build in the [SiteOrigin CSS](https://github.com/siteorigin/so-css) plugin, `npm install` should be run in both the SiteOrigin CSS plugin folder and the build folder.
5. Get some coffee while npm installs the required packages.

## Configuring builds
Each plugin has it's own slug and different files needed for a build. So any plugin that uses this build is required to have a configuration file called `build-config.js` in the root of the plugin directory. This file is in the form of an npm module which simply returns a configuration object used by the gulpfile to determine the files and folders needed for the build. Below is an excerpt from the SiteOrigin CSS Editor plugin `build-config.js` file:

```
module.exports = {
    slug: 'so-css',
    jsMinSuffix: '.min',
    version: {
        src: [
            'so-css.php',
            'readme.txt'
        ]
    },
    less: {
        src:['css/**/*.less'],
        include:[]
    },
};
```

## Running builds
There are two main build tasks, `build:release` and `build:dev`.

The release task performs the following subtasks:

1. Updates the version number in the required files.
2. Compiles required SASS and LESS files to CSS.
3. Processes JavaScript files with Babel and Browserify.
4. Minifies CSS and JavaScript files.
5. Copies all files to a `dist/` folder.
6. Generates translation (POT) files.
7. Creates a `.zip` archive with the appropriate filename ready for uploading to wordpress.org.

Release task usage:

```bash
npm run build:release --release=1.2.3
```

Or alternatively:

```bash
gulp buildRelease --release=1.2.3
```

The development build task includes:

1. Initial compilation of LESS/SASS files to CSS.
2. Initial processing of JavaScript files.
3. Watch LESS, SASS, and JavaScript files for changes and recompile automatically.

Development task usage:

```bash
npm run build:dev
```

## Individual tasks

You can also run individual build tasks:

```bash
npm run css      # Compile LESS/SASS files
npm run js       # Process JavaScript files
npm run minify   # Minify CSS and JS files
npm run copy     # Copy files to tmp directory
npm run i18n     # Generate translation files
```

## Special tasks

### Updating Font Awesome
```bash
npm run update:font-awesome
```

### Updating the Google fonts array
```bash
npm run updateGoogleFonts --apiKey=YOUR_API_KEY
```

The Google Fonts task will require an update to the build-config file in each plugin to specify the name and location of the fonts file.

## Gulp 5 Migration Notes

This build system has been migrated from Gulp 3 to Gulp 5 with the following key changes:

- **ES Modules**: All tasks now use ES module syntax instead of CommonJS.
- **Task Binding**: Individual tasks require explicit binding for proper configuration passing.
- **Copy Patterns**: Updated glob patterns for better file selection and exclusion handling.
- **Dependencies**: Updated to use `gulp-terser` instead of `gulp-uglify-es` and modern package versions.

## Troubleshooting

If you encounter issues:

1. Ensure Node.js 18+ is installed.
2. Clear `node_modules` and run `npm install` again.
3. Check that all required files exist in the plugin's `build-config.js`.
4. Verify that the build directory has proper read/write permissions.
