# Building SiteOrigin plugins
There are few steps necessary to prepare a plugin for release on the WordPress.org plugin directory. We use [Gulp](http://gulpjs.com/) to automate this.

## Environment setup
1. [Download](https://nodejs.org/download/) and install Node.js and npm.
2. Install gulp using `npm install -g gulp`.
3. In the plugin folder, ensure the plugin-build repository has been added as a submodule in a folder called 'build' and is up to date. This can be done using `git submodule add git@github.com:siteorigin/plugin-build.git build`
4. In a terminal, navigate to the build directory in the plugin and run `npm install`
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
There are two build tasks, `build:release` and `build:dev`.

The release task performs the following subtasks:

1. Updates the version number in the required files.
2. Compiles required SASS and LESS files to CSS.
3. Minifies required JavaScript files and adds the suffix specified in the `build-config.js` file.
4. Copies all files to a `dist/` folder.
5. Creates a `.zip` archive with the appropriate filename ready for uploading to wordpress.org.

Release task usage:

`gulp build:release -v {version}`

Where `{version}` should be replaced with the required version number.
For example, say the next version of the plugin is 1.2.3:

`gulp build:release -v {1.2.3}`

The dev build task only has one subtask:

1) Watch LESS and/or SASS files for changes and compile to CSS.

This is simply to avoid having to manually recompile LESS/SASS files while working on them.
