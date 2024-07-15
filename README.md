# Building SiteOrigin plugins
There are a few steps necessary to prepare a plugin for release on the WordPress.org plugin directory. We use [Gulp](http://gulpjs.com/) to automate this process.

## Environment setup
1. [Download](https://nodejs.org/download/) and install Node.js and npm.
2. Install gulp globally using `npm install -g gulp`.
3. In the plugin folder, ensure the plugin-build repository has been added as a submodule in a folder called 'build' and is up to date. This can be done using `git submodule add git@github.com:siteorigin/plugin-build.git build`.
4. In a terminal, navigate to the build directory in the plugin and run `npm install`. When using plugin-build in the [SiteOrigin CSS](https://github.com/siteorigin/so-css) plugin, `npm install` should be run in both the SiteOrigin CSS plugin folder and the build folder.
5. Grab a coffee while npm installs the required packages.

## Configuring builds
Each plugin has its own slug and different files needed for a build. Any plugin that uses this build is required to have a configuration file called `build-config.js` in the root of the plugin directory. This file is in the form of an npm module which simply returns a configuration object used by the gulpfile to determine the files and folders needed for the build. Here's an excerpt from the SiteOrigin CSS Editor plugin `build-config.js` file:

```javascript
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
There are two main build tasks: `build:release` and `build:dev`.

### Release Build
The release task performs the following subtasks:

1. Updates the version number in the required files.
2. Compiles required SASS and LESS files to CSS.
3. Minifies required JavaScript files and adds the suffix specified in the `build-config.js` file.
4. Copies all files to a `dist/` folder.
5. Creates a `.zip` archive with the appropriate filename ready for uploading to wordpress.org.

To run a release build, use:

```
npm run build:release --release=X.X.X
```

Replace `X.X.X` with the desired version number. For example, if the next version of the plugin is 1.2.3:

```
npm run build:release --release=1.2.3
```

### Development Build
The dev build task has one main function:

1. Watch LESS and/or SASS files for changes and compile them to CSS.

This eliminates the need to manually recompile LESS/SASS files while working on them.

To run a development build, use:

```
npm run build:dev
```

## Updating the Google Fonts Array
To update the Google Fonts array, use:

```
npm run updateGoogleFonts --apiKey=YOUR_API_KEY
```

Replace `YOUR_API_KEY` with your actual Google Fonts API key. This task requires an update to the `build-config.js` file in each plugin to specify the name and location of the fonts file.

Remember to check the `build-config.js` file in your plugin to ensure it's correctly configured for these tasks.
