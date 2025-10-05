import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const legacyMarker = "util.promisify(require('glob'))";

const patchedSource = `\
'use strict';\n\nconst path = require('path');\nconst utils = require('./utils');\nconst globModule = require('glob');\n\nconst GlobCtor = (globModule && globModule.Glob) ? globModule.Glob : globModule;\n\nconst createGlobPromise = (pattern, options) => {\n  const onMatch = utils.onMatch(pattern, options);\n\n  return new Promise((resolve, reject) => {\n    const globber = new GlobCtor(pattern, options, (err, files) => {\n      if (typeof globber.off === 'function') {\n        globber.off('match', onMatch);\n      } else if (typeof globber.removeListener === 'function') {\n        globber.removeListener('match', onMatch);\n      }\n\n      if (err) {\n        reject(err);\n      } else {\n        resolve(files);\n      }\n    });\n\n    if (typeof globber.on === 'function') {\n      globber.on('match', onMatch);\n    } else if (typeof globber.addListener === 'function') {\n      globber.addListener('match', onMatch);\n    }\n  });\n};\n\nmodule.exports = async (patterns, options) => {\n  const { expand, getPaths, sift, setIgnores } = utils;\n  patterns = [].concat(patterns || []);\n\n  const opts = Object.assign({ cwd: '.', nosort: true }, options);\n  opts.cwd = path.resolve(expand(opts.cwd));\n\n  const sifted = sift(patterns, opts);\n  if (sifted === null) {\n    throw new Error('invalid glob pattern: ' + patterns);\n  }\n\n  if (sifted.globs === 0) {\n    return Promise.resolve(getPaths(patterns, opts));\n  }\n\n  const { excludes, includes } = sifted;\n  const config = include => setIgnores(opts, excludes, include.index);\n  const pending = [];\n  const files = [];\n\n  const onFiles = options => dirents => {\n    files.push(...dirents);\n\n    if (options.onFiles) {\n      return options.onFiles(dirents, options);\n    }\n  };\n\n  for (const include of includes) {\n    const opt = config(include);\n    pending.push(createGlobPromise(include.pattern, opt).then(onFiles(opt)));\n  }\n\n  return Promise.all(pending).then(() => files);\n};\n`;

const candidates = [
  path.join(rootDir, 'node_modules', 'matched', 'lib', 'promise.js'),
  path.join(rootDir, 'node_modules', 'wp-pot', 'node_modules', 'matched', 'lib', 'promise.js')
];

let patchedAny = false;

for (const file of candidates) {
  if (!fs.existsSync(file)) {
    continue;
  }

  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes(legacyMarker)) {
    continue;
  }

  fs.writeFileSync(file, patchedSource);
  console.log(`[patch-matched] Replaced legacy implementation in ${path.relative(rootDir, file)}`);
  patchedAny = true;
}

if (!patchedAny) {
  console.log('[patch-matched] No legacy matched implementation detected; skipping patch.');
}
