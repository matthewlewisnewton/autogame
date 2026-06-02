1. Elevated spire enemies and the summit objective enemy render at flat-world Y instead of on their tier floors.
   Files: `game/client/renderer.js`, `game/server/progression.js`
   Fix: position enemies, health bars, lock-on rings, telegraphs, and related combat visuals from `sampleFloorY(layout, x, z)` or persist entity `y` when spawned/moved.

2. The documented `generateLayout({ stage: "spire-ascent" })` entry point returns the default grid layout, not the spire layout.
   Files: `game/server/dungeon.js`, `game/server/test/dungeon.test.js`
   Fix: add an object-options overload or recognize `{ stage: 'spire-ascent' }` as a first argument while preserving existing seeded calls; cover it with a unit test.
