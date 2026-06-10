# 02 — Rigid (fixed) layout mode for the ice-cavern profile

Teach `generateIceCavern` in `game/server/dungeon.js` to honor `layoutMode: 'rigid'` the way sunken-canyon and spire-ascent already do: seed-independent fixed geometry (fixed ramp count, declaration-order cover, fixed decor) while leaving `default` mode byte-for-byte unchanged. This gives frost_crossing Tier II its "more rigid/fixed layout" per the 253-257 level-2 pattern; sub-ticket 03 selects it via the tier def's `layoutMode: 'rigid'` (the pass-through in `quests.js getLayoutGenerationOptions` is already generic — do not change quests.js here).

## Acceptance Criteria

- `generateLayout(seed, 'ice-cavern', { slopes: true, layoutMode: 'rigid' })` produces deep-equal output (rooms, walls, passages, cover, entryDecor, landmarks) for two different seeds — the rigid layout is seed-independent.
- The rigid ice-cavern keeps the canonical structure: stone entry pad (`role: 'start'`, `band: 'entry'`), exactly 2 connector ramps, the large slippery ice sheet (`band: 'ice'`, `floorSurface: 'slippery'`, `spawnWeight: 2`), and the stone treasure pad (`role: 'treasure'`) with the `ice_cairn` landmark at its center.
- Rigid mode places exactly 2 cover pieces on each stone pad taken in declaration order from the existing `stoneCandidatePool` (no RNG shuffle), and a fixed count of entry `icicle_cluster` decor at deterministic positions.
- `generateLayout(seed, 'ice-cavern', { slopes: true })` (default mode) returns exactly the same output as before this change for any given seed — the default RNG draw sequence must not be disturbed (assert deep equality against current behavior in the test for at least one seed, e.g. snapshot the room/ramp count and cover positions before refactoring).
- `normalizeLayoutMode` handles the option (already exists) — unknown/absent `layoutMode` falls back to default behavior.
- New test `game/server/test/ice_cavern_rigid.test.js` covers: rigid stability across ≥ 2 distinct seeds, rigid structure (2 ramps, slippery ice band, ice_cairn landmark, cover counts), and default-mode unchanged/varying behavior (model it on the rigid-layout test in `canyon_descent_tier2.test.js`, e.g. "rigid geometry is stable across seeds; default varies ramp count").
- Existing layout/spawn tests still pass (`cd game && pnpm test:quick`), in particular `frost_crossing_spawn.test.js` and `frost_crossing_stage_boss.test.js` which use the default ice-cavern layout.

## Technical Specs

- `game/server/dungeon.js` only:
  - Extend the `ICE_CAVERN` constants block with rigid tuning, following the `SUNKEN_CANYON` precedent (its `rigidCentralRampCount` etc.): e.g. `rigidRampCount: 2`, `rigidCoverPerStonePad: 2`, `rigidEntryDecorCount: 2`.
  - In `generateIceCavern(seed, options = {})`, read `const layoutMode = normalizeLayoutMode(options.layoutMode)`.
  - Rigid branch: `numRamps` fixed at 2 (the two outer `rampXOffsets`, i.e. `[-3, 3]`, matching the existing 2-ramp arm of the ternary); cover via the existing declaration-order helper used by crowded rigid mode (`placeCoverDeclarationOrder`, ~line 819) or an equivalent first-N slice of `stoneCandidatePool` with the same clearance rules as `scatterCoverInArena`; entry decor with a fixed count and deterministic positions (no `rng()` influence on output).
  - Keep all `rng()` call sites intact on the default path (same order, same count) so default layouts are bit-identical to today. The simplest structure: branch early on `layoutMode` and keep the existing body as the default branch.
  - Landmarks stay `[{ x: treasure.x, z: treasure.z, type: 'ice_cairn' }]` in both modes (sub-ticket 03's stage-boss encounter anchors on `ice_cairn`).
- `game/server/test/ice_cavern_rigid.test.js` — new file using `generateLayout` / `questLayoutSeed` from `../dungeon.js`.

## Verification: code
