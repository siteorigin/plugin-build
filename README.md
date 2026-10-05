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

To release a plugin, follow the [Release procedure](#release-procedure). It includes this build.

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
npx cross-env gulp updateGoogleFontsTask --apiKey=YOUR_API_KEY
```

The Google Fonts task will require an update to the build-config file in each plugin to specify the name and location of the fonts file.

## Release procedure
Follow these steps in order to release a plugin. A person or an agent can follow them. `X.Y.Z` is the new version. `<slug>` is the `slug` in `build-config.js`. Run the git commands in the plugin folder.

1. **Check the preconditions.**
   - You are on `develop`.
   - `git status` shows a clean tree.
   - `develop` is equal to `origin/develop`. Run `git fetch` first, then `git rev-parse develop origin/develop` must print the same hash twice.
   - Find the last release with `git tag | sort -V | tail -1`.
   - The plugin's tests pass.
2. **Start the release.** Run `git flow release start X.Y.Z`. We use AVH git flow. Tags have no `v` prefix.
3. **Write the changelog.** Edit `readme.txt` and `changelog.txt`. Add the entry for X.Y.Z, in the same format as the entries below it (`= X.Y.Z – DD Month YYYY =`). Write it against the last release:
   - Say what changed for a user who upgrades from the last release.
   - Work that was built and repaired in this cycle is one "Added" line. That bug never reached a user.
   - Collapse internal history. Refactors, review findings and repair steps do not go in.
   - Block, widget and addon names are proper nouns: "the Image Widget", "the Group block".
   - Raise "Tested up to" in `readme.txt` if needed.

   Do NOT commit.
4. **HUMAN GATE. Stop here.** The `readme.txt` and `changelog.txt` edits sit uncommitted in the working tree when you call the owner. The owner reads `git diff` in the repository. The owner edits the files in place if needed. Then the owner says "commit". Nothing is committed, built, tagged or pushed before that.
5. **Commit the changelog.** Make one commit on the release branch. Use the repository's style, for example `Update changelog for X.Y.Z`.
6. **Build the release package.** In the plugin's `build/` folder, run `npm run build:release --release=X.Y.Z`. The zip is `dist/<slug>.X.Y.Z.zip`. The unzipped release is `dist/<slug>/`. Then:
   - Record the zip's SHA-256: `shasum -a 256 dist/<slug>.X.Y.Z.zip`.
   - Confirm that the zip has X.Y.Z in the plugin header `Version:`, in the version constant (`define( '..._VERSION', 'X.Y.Z' )`) and in the readme `Stable tag:`. Use `unzip -p` to read these files from the zip.
   - Confirm that the zip has no `tests/`, `.github/` or `docs/plans/` files. `unzip -l dist/<slug>.X.Y.Z.zip | grep -E '/(tests|\.github|docs/plans)/'` must print nothing.
7. **DEMO GATE.** Install the built zip on demo.siteorigin.com before anything goes to wordpress.org.
   - Keep a rollback copy of the current plugin directory outside the web root.
   - Install with `wp plugin install <zip> --force`. Do not change activation.
   - Confirm the version.
   - Request the network front page and three site front pages. Confirm HTTP 200 and no PHP notices.
   - Send the owner one test URL of a page that uses the plugin. Add the admin URL of its settings or editor screen, the backup path and the rollback command.

   Stop. The owner gives a once-over and says "ok". On "not ok", roll the demo back and return to the fix. Only after "ok" does the owner upload to wordpress.org.
8. **The owner uploads to wordpress.org.** Today the owner copies the contents of `dist/<slug>/` into the local SVN `trunk/` and commits by hand. [Issue #56](https://github.com/siteorigin/plugin-build/issues/56) will automate the copy. It comes after every plugin is on this branch.
9. **Finish the release.** Wait until the owner confirms the upload. Then:
   - Run `git flow release finish -m "X.Y.Z" X.Y.Z`.
   - Push `develop`, `master` and the tag together: `git push --atomic origin develop master X.Y.Z`.
   - Confirm that `master` is not behind `develop` on GitHub: `gh api repos/siteorigin/<repo>/compare/develop...master --jq .behind_by` must print `0`.
   - Create the GitHub release on the tag, in the repository's existing format: the title is `X.Y.Z` and the body is the changelog lines for X.Y.Z. Use `gh release create X.Y.Z --title "X.Y.Z" --notes-file <file>`.
10. **Rules.**
   - Never hand-merge, cherry-pick or rebase around git flow.
   - Never commit `docs/plans/`.
   - Never add AI attribution to a commit, tag, release or PR.
   - Source keeps its dev version markers (`Version: dev`, `'dev'` in the version constant, `Stable tag: trunk`). The build sets the version.

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
