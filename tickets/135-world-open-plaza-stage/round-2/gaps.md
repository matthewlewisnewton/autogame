1. Captured runtime proof is missing: `metrics.json` has `"ok": false`, `failure_kind: "capture_failed"`, `console.log` is absent, and `screenshot.log` reports missing Playwright.
   Files: none in `game/`; harness dependency/capture environment
   Fix: restore the Playwright dependency for `harness/screenshot.mjs` or rerun capture in an environment where it is installed, then verify `metrics.json` is `ok:true`.

2. Sloped cover platforms are not walkable because each platform uses the same footprint as a solid cover collider, so players cannot move onto the sloped surface.
   Files: `game/server/dungeon.js`, `game/client/dungeon.js`, `game/server/simulation.js`
   Fix: make the sloped platform a distinct walkable footprint around/adjacent to the cover, or make the platform larger than the cover while only the cover interior collides; add tests that movement can stand on the sloped platform area.

3. Open-plaza enemy/objective placement can put entities inside cover because the no-combat-room fallback samples the single room without rejecting `layout.cover` colliders.
   Files: `game/server/progression.js`, `game/server/simulation.js`, `game/server/dungeon.js`
   Fix: add cover-aware random position helpers for one-room plaza fallbacks and use them for enemies, loot, and item objectives; test generated open-plaza spawns never overlap cover.

4. The `open-plaza-stage` debug scenario is not equivalent to the normal `open_plaza_trial` flow because it enters play and spawns the run before swapping to the open-plaza layout.
   Files: `game/server/index.js`
   Fix: set/select `open_plaza_trial` and apply its layout before `enterPlayingPhase()`, or rebuild the run/enemies/objective after swapping so the debug end-state matches normal quest deployment.
