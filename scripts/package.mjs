// scripts/package.mjs
// Builds a chrome web store-ready zip from the extension source.
// Excludes dev files (.git, node_modules, .github, scripts, docs, etc).

import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const distDir = resolve(root, 'dist');
const outfile = `claude-context-pill-${pkg.version}.zip`;
const outpath = resolve(distDir, outfile);

mkdirSync(distDir, { recursive: true });

// Files and dirs to include
const include = [
  'manifest.json',
  'content.js',
  'overhead-detector.js',
  'calibrator.js',
  'pill.css',
  'popup.html',
  'popup.js',
  'popup.css',
  'icons',
  'vendor'
];

for (const p of include) {
  if (!existsSync(resolve(root, p))) {
    console.error(`required path missing: ${p}`);
    process.exit(1);
  }
}

// Remove old zip
try { execSync(`rm -f "${outpath}"`); } catch { /* noop */ }

const cmd = `cd "${root}" && zip -r "${outpath}" ${include.map((p) => `"${p}"`).join(' ')} -x "*/.DS_Store"`;
execSync(cmd, { stdio: 'inherit' });

const size = statSync(outpath).size;
const sizeKb = (size / 1024).toFixed(1);
console.log(`\npackaged: dist/${outfile} (${sizeKb} KB)`);
