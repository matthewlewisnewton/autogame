# 08 — Spire Ascent final-tier exit objective

Wire the `spire_ascent` quest so run victory requires reaching and completing an objective on the top treasure tier, not only clearing enemies on lower combat tiers.

## Acceptance Criteria

- `spire_ascent` run objective cannot complete on enemy kills alone; a final-tier exit step is required (new `objectiveType` or quest flag with `reachedExit` / equivalent tracked in `run.objective`).
- On deploy for `spire_ascent`, spawn exactly one interactable exit on the treasure-tier room only (reuse crystal pickup flow or a dedicated exit loot kind) at the room’s walkable position with correct `y` from floor sampling.
- `isRunObjectiveComplete` returns true only when all required enemies are defeated **and** the exit step is satisfied.
- Enemy spawns remain distributed across multiple combat tiers (existing spire tier plan in `progression.js` unchanged in spirit; top `treasure` tier stays non-combat).
- Server unit test: simulating all enemies dead without exit does **not** complete the run; satisfying exit after enemies dead does.
- Client renders the exit/interactable at the elevated treasure tier Y (depends on sub-ticket 07 for marker height; may touch `dungeon.js` only if exit uses the treasure marker path).

## Technical Specs

- **`game/server/quests.js`**: set `spire_ascent` to an objective that includes final-tier exit (e.g. `objectiveType: 'defeat_enemies_reach_exit'` or `requiresExit: true` with documented fields).
- **`game/server/progression.js`**:
  - Extend `createRunState`, `isRunObjectiveComplete`, and pickup/zone handlers to track exit completion separately from `defeatedEnemies`.
  - Add `spawnSpireExit(layout, rng)` (or extend `spawnCrystals`) to place a single exit interactable only in `roomsByRole(layout, 'treasure')[0]` for `layout.stage === 'spire-ascent'`.
  - Call exit spawn from `spawnEnemies()` when the spire quest is active.
- **`game/server/dungeon.js`**: no layout changes unless exit needs layout metadata; treasure role remains on top tier.
- **`game/client/dungeon.js`**: if exit reuses treasure marker, ensure it reflects exit state; otherwise add a distinct mesh keyed off layout/loot kind in state broadcasts.
- **`game/server/test/server.test.js`** or **`integration.test.js`**: test incomplete objective with enemies cleared only; test victory path with exit triggered on top tier.

## Verification: code
