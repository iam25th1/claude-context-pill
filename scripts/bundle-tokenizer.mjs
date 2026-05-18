// scripts/bundle-tokenizer.mjs
// Rebuilds vendor/tokenizer.bundle.js from js-tiktoken in node_modules.
// Run via: npm run bundle:tokenizer

import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const entrySource = `
import { Tiktoken } from 'js-tiktoken/lite';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';

const encoder = new Tiktoken(cl100k_base);

window.__ccp_tokenizer = {
  encode: (text) => encoder.encode(text || ''),
  count: (text) => encoder.encode(text || '').length,
  ready: true
};
window.dispatchEvent(new CustomEvent('ccp:tokenizer-ready'));
`;

const entryPath = resolve(repoRoot, '_tokenizer-entry.tmp.mjs');
writeFileSync(entryPath, entrySource);

try {
  mkdirSync(resolve(repoRoot, 'vendor'), { recursive: true });
  const result = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'iife',
    target: 'chrome110',
    minify: true,
    outfile: resolve(repoRoot, 'vendor/tokenizer.bundle.js'),
    legalComments: 'none',
    write: true,
    logLevel: 'info'
  });
  if (result.errors?.length) {
    console.error('build errors:', result.errors);
    process.exit(1);
  }
  console.log('tokenizer bundle written to vendor/tokenizer.bundle.js');
} finally {
  try { (await import('node:fs')).unlinkSync(entryPath); } catch { /* noop */ }
}
