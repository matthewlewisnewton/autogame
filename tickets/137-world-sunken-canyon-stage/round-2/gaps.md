1. `generateLayout({ stage: "sunken-canyon" })` does not select the Sunken Canyon stage; it returns the default layout with no bands or `stageMeta`.
   Files: `game/server/dungeon.js`, `game/server/test/dungeon.test.js`
   Fix: Teach `generateLayout` to recognize the object stage selector while preserving existing `(seed, profile, options)` calls, and add a unit test for the exact API.
