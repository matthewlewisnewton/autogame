// ESM re-export of the CJS floorSampling module for Vite/ESM consumers.
// The original floorSampling.js uses module.exports (CJS); this file
// wraps it so the client can use standard `import { … }` syntax.

import mod from './floorSampling.js';

export const { sampleFloorY, DEFAULT_FLOOR_Y } = mod;
