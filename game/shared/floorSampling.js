// ── floorSampling CJS wrapper ──
// Thin wrapper that loads the canonical ESM source at require time.
// The ESM file (floorSampling.esm.js) is the single source of truth;
// this file must never contain a duplicated function body.
//
// ESM eval-bridge constraints:
//   Supported in floorSampling.esm.js — plain `export function …`,
//   `export const`, `export let`, `export var`.
//   Unsupported — top-level `import` statements or other non-trivial ESM
//   syntax (e.g. dynamic imports, `export * from`). Adding them will
//   break the server `require()` unless this bridge is updated.

const fs = require('fs');
const path = require('path');

const esmPath = path.resolve(__dirname, 'floorSampling.esm.js');
let source = fs.readFileSync(esmPath, 'utf8');

// Strip ESM export keywords so the source is valid eval-able JS:
//   export function foo(...) → function foo(...)
//   export const X = ...     → const X = ...
source = source.replace(/^export function /gm, 'function ');
source = source.replace(/^export (const|let|var) /gm, '$1 ');

// Wrap in a strict-mode Function so const/function bindings are captured
// reliably regardless of eval scoping rules in Node.js modules.
const mod = (new Function(
	'"use strict";\n' +
	source + '\n' +
	'return { sampleFloorY, DEFAULT_FLOOR_Y };'
))();

module.exports = mod;
