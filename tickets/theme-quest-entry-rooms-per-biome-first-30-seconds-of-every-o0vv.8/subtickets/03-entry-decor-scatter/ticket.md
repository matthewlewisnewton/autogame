# Entry room visual decor scatter (icicles / embers / vault rubble)

A palette change alone may not read at a glance; add a light visual dressing pass using visual-only decor props scattered in each biome's entry room. Reuse the deterministic scatter pattern from `scatterCoverInArena` but emit a new `entryDecor` array that does **not** participate in collision or cover overlap checks.

## Acceptance Criteria

- Ice-cavern, fire-cavern, and crowded layouts include a non-empty `entryDecor` array on the start room's footprint (2–4 pieces per entry, deterministic per seed).
- Decor types: `icicle_cluster` (ice-cavern), `ember_vent` (fire-cavern), `vault_rubble` (crowded). Each entry has `{ type, x, z, yaw? }` only — no `width`/`height` collision fields.
- `buildDungeon()` renders one decor group per `entryDecor` item with `userData.decorType` set; groups are added to the scene but are not registered as cover colliders.
- `layout.cover` arrays and collision simulation are unchanged (no new cover pieces in entry rooms).
- Client and server tests confirm decor presence and mesh tags at a fixed seed.

## Technical Specs

- **`game/server/dungeon.js`** — add `scatterEntryDecor(rng, { centerX, centerZ, half, spawnClear, type, count })` mirroring `scatterCoverInArena` placement rules but returning decor entries (no collision footprint). Call it from `generateIceCavern` (entry room, `icicle_cluster`), `generateFireCavern` (rim/entry room, `ember_vent`), and the crowded grid path (start room, `vault_rubble`). Attach results as `layout.entryDecor = [...]`.
- **`game/client/dungeon.js`** — add `buildEntryDecorMesh(type, materials)` producing simple low-poly groups (e.g. hanging icicle cones, glowing ember cracks, fallen vault blocks) tinted from the active profile entry/accent colors. In `buildDungeon()`, after room walls, iterate `layout.entryDecor || []`, position at sampled floor Y, push child meshes to `meshes`.
- **`game/server/test/dungeon.test.js`** — assert `entryDecor.length >= 2` and correct `type` per profile at seed 42.
- **`game/client/test/dungeon.test.js`** — assert decor meshes carry `userData.decorType` matching the layout entry.

## Verification: code
