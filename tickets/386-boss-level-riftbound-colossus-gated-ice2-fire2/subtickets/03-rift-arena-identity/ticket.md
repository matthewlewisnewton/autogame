# 03 — Rift arena identity (ice/fire themed boss arena)

Give the Rift Convergence boss arena a visual identity distinct from the plain
boss arena: an `arenaTheme: 'rift'` option on `generateBossArena` that adds
deterministic ice-half / fire-half floor markings, wired from the quest def and
rendered client-side with distinct frost and ember colors.

## Acceptance Criteria

- `generateBossArena(seed, options)` in `game/server/dungeon.js` accepts `options.arenaTheme === 'rift'` and, only then, appends rift floor markings to `layout.floorMarkings`, e.g. `{ type: 'rift_ice_band', … }` covering the west half and `{ type: 'rift_ember_band', … }` covering the east half (rectangles or half-rings with explicit x/z/extent fields), while keeping the existing `center_ring` marking and `arena_dais` landmark.
- Without `arenaTheme: 'rift'`, the boss-arena layout is byte-identical to before (existing `crucible_duel` / `vault_onslaught` layouts unchanged) — asserted in a server test.
- The rift markings are deterministic for a given seed, lie fully inside the arena bounds, and add NO walls/cover — walkability and collision are unchanged (markings are cosmetic floor decals only).
- `getLayoutGenerationOptions(questId, tier)` in `game/server/quests.js` passes the tier def's `arenaTheme` through to the generator options, and the `rift_convergence` tier-1 def declares `arenaTheme: 'rift'` — asserted in a server test (a generated `rift_convergence` layout contains both rift marking types).
- The client floor-marking builder in `game/client/dungeon.js` (the function at ~line 1165 that currently only handles `'center_ring'` and returns null otherwise) renders the two new marking types as flat floor-decal meshes with clearly distinct materials: frost/ice-blue for `rift_ice_band`, ember-orange for `rift_ember_band`; unknown types still return null.
- A client test asserts both marking types produce meshes with the distinct colors and that `userData.floorMarkingType` is set accordingly.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/dungeon.js` — extend `generateBossArena` (~line 2405); markings go into the `layout.floorMarkings` array (~line 2459). Keep marking geometry data-only (positions/extents/types); follow the `center_ring` shape conventions.
- `game/server/quests.js` — extend `getLayoutGenerationOptions` (~line 1823) to include `arenaTheme: quest.arenaTheme` when set (it already returns `{ slopes, layoutMode }`); add `arenaTheme: 'rift'` to the `rift_convergence` tier-1 def. The option flows through the existing `generateLayout(seed, profile, getLayoutGenerationOptions(…))` call sites in `game/server/index.js` (~lines 424, 441) — no changes there.
- `game/client/dungeon.js` — extend the floor-marking mesh builder (~line 1165); markings are iterated at ~line 1415. Reuse the existing marking mesh/material pattern (flat geometry slightly above floor Y).
- Tests: extend `game/server/test/boss_level_schema.test.js` or add `rift_arena.test.js`; client test under `game/client/test/` following the existing `dungeon.test.js` floor-marking coverage.
- Depends on sub-ticket 02 (the `rift_convergence` quest def must exist to carry `arenaTheme`).

## Verification: code
