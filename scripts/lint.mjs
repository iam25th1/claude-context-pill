// scripts/lint.mjs
// Chrome-extension linter. Validates manifest.json structure, permission
// surface, CSP, and required files. Replaces web-ext lint, which is
// firefox-targeted and false-flags chrome MV3 extensions.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function readJson(rel) {
  return JSON.parse(readFileSync(resolve(root, rel), 'utf8'));
}

// 1. manifest validation
let manifest;
try {
  manifest = readJson('manifest.json');
} catch (e) {
  err(`could not read manifest.json: ${e.message}`);
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  err(`manifest_version must be 3, got ${manifest.manifest_version}`);
}
if (!manifest.name) err('manifest.name is required');
if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  err(`manifest.version must be semver, got ${manifest.version}`);
}

// 2. permission surface
const broadPerms = ['<all_urls>', 'tabs', 'webRequest', 'webRequestBlocking', 'cookies', 'history', 'bookmarks', 'management'];
for (const p of (manifest.permissions || [])) {
  if (broadPerms.includes(p)) err(`broad permission requested: ${p}`);
}
for (const h of (manifest.host_permissions || [])) {
  if (h.includes('<all_urls>') || h === 'http://*/*' || h === 'https://*/*') {
    err(`overly broad host permission: ${h}`);
  }
}

// 3. CSP must be locked down
const csp = manifest.content_security_policy?.extension_pages || '';
if (!csp.includes(`script-src 'self'`)) err(`CSP must include script-src 'self'`);
if (csp.includes('unsafe-eval')) err('CSP must not allow unsafe-eval');
if (csp.includes('unsafe-inline')) err('CSP must not allow unsafe-inline');

// 4. version sync across manifest, package.json
let pkg;
try { pkg = readJson('package.json'); } catch { err('could not read package.json'); }
if (pkg && pkg.version !== manifest.version) {
  err(`version mismatch: manifest=${manifest.version} package.json=${pkg.version}`);
}

// 5. required files
const requiredFiles = [
  'manifest.json',
  'content.js',
  'overhead-detector.js',
  'calibrator.js',
  'vendor/tokenizer.bundle.js',
  'pill.css',
  'popup.html',
  'popup.js',
  'popup.css',
  'README.md',
  'LICENSE',
  'PRIVACY.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];
for (const f of requiredFiles) {
  if (!existsSync(resolve(root, f))) err(`required file missing: ${f}`);
}

// 6. tokenizer bundle sanity
const bundlePath = resolve(root, 'vendor/tokenizer.bundle.js');
if (existsSync(bundlePath)) {
  const size = statSync(bundlePath).size;
  if (size < 500_000) err(`tokenizer bundle suspiciously small: ${size} bytes`);
  if (size > 5_000_000) err(`tokenizer bundle suspiciously large: ${size} bytes`);
}

// 7. scan for eval / new Function / inline event handlers in our js
const filesToScan = ['content.js', 'overhead-detector.js', 'calibrator.js', 'popup.js'];
for (const f of filesToScan) {
  const fp = resolve(root, f);
  if (!existsSync(fp)) continue;
  const src = readFileSync(fp, 'utf8');
  if (/\beval\s*\(/.test(src)) err(`${f} uses eval()`);
  if (/new\s+Function\s*\(/.test(src)) err(`${f} uses new Function()`);
}

// 8. content_scripts loads tokenizer before content.js
const cs = (manifest.content_scripts || [])[0]?.js || [];
const tIdx = cs.findIndex((p) => p.includes('tokenizer.bundle'));
const cIdx = cs.findIndex((p) => p === 'content.js');
if (tIdx >= 0 && cIdx >= 0 && tIdx > cIdx) {
  err('tokenizer bundle must load before content.js');
}

// ---- report ----
if (warnings.length) {
  console.log('warnings:');
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log('errors:');
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log(`lint passed: manifest v${manifest.version}, ${requiredFiles.length} files checked, 0 errors`);
