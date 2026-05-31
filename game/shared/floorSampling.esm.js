// ESM re-export of the CJS floorSampling module for Vite/ESM consumers.
// The original floorSampling.js uses module.exports (CJS); this file
// wraps it so the client can use standard `import { … }` syntax.

import * as mod from './floorSampling.js';
const m = mod.default || mod;
export const sampleFloorY = m.sampleFloorY;
export const DEFAULT_FLOOR_Y = m.DEFAULT_FLOOR_Y;
