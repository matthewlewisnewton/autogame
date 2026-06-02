// CJS bridge for rampGeometry.js (ESM source of truth).
const fs = require('fs');
const path = require('path');

const esmPath = path.resolve(__dirname, 'rampGeometry.js');
let source = fs.readFileSync(esmPath, 'utf8');
source = source.replace(/^export function /gm, 'function ');
source = source.replace(/^export (const|let|var) /gm, '$1 ');

const mod = (new Function(
  '"use strict";\n' +
  source + '\n' +
  'return { buildRampFloorCorners, averageRampSlope };'
))();

module.exports = mod;
