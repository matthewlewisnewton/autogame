# 01 — Sunken-canyon rigid layout mode

Extend the reusable `layoutMode: 'rigid'` option from ticket 254 to the `sunken-canyon` profile so Tier-2 runs can use seed-stable canyon geometry while preserving all existing canyon identity features (plateau/canyon bands, lateral edge ramps, cliff lips/hazards, monolith landmark, plateau→canyon reachability).

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon', options)` threads `layoutMode` into `generateSunkenCanyon(seed, options)`; unknown modes fall back to `'default'`.
- In `'default'` mode, current behavior is unchanged: central ramp count varies 2–3 across seeds (4–5 total ramps with edge connectors), cover scatter and monolith placement remain seed-driven.
- In `'rigid'` mode, structural RNG is removed: fixed central ramp selection, ordered cover placement, and fixed monolith position produce layouts that are identical across different seeds (or differ only in fields explicitly documented as seed-driven cosmetics — there should be none for rigid canyon).
- Rigid layouts still satisfy all sunken-canyon invariants: `profile: 'sunken-canyon'`, plateau=start / canyon=treasure / ramps=connector, Y drop ≥ 8, perimeter walls, ≥ 6 canyon cover pieces, one `canyon_monolith`, cliff lips per ramp, plateau cliff hazards, and full foot reachability from plateau to canyon (including lateral edge probes).
- `getLayoutGenerationOptions('canyon_descent', 1)` continues to return `{ slopes: true, layoutMode: 'default' }` (no quest-tier change in this sub-ticket).
- Unit tests in `game/server/test/dungeon.test.js` prove rigid determinism across seeds and that default mode still varies ramp count; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/dungeon.js`**
  - Change `generateLayout` sunken-canyon branch to `return generateSunkenCanyon(seed, options)`.
  - Update `generateSunkenCanyon(seed, options = {})` to read `normalizeLayoutMode(options.layoutMode)`.
  - Add rigid constants on `SUNKEN_CANYON` (e.g. `rigidCentralRampCount: 3` for all three `rampXOffsets`, fixed monolith offsets) used only when `layoutMode === 'rigid'`.
  - Rigid path: pin `numRamps` / `centralRampCenters`; replace `scatterCoverInArena` with `placeCoverInArenaOrdered` (same candidate pool as default); place monolith at a fixed interior coordinate instead of RNG retry loop.
  - Do **not** alter `buildSunkenCanyonCliffLips`, `buildSunkenCanyonCliffHazards`, ramp room builders, or band/role assignment — rigid mode only pins values that are currently RNG-driven.
- **`game/server/test/dungeon.test.js`**
  - New cases under the existing `generateLayout(seed, 'sunken-canyon')` describe block:
    - Rigid mode: two different seeds yield deep-equal structural fields (`rooms`, `cover`, `landmarks`, `cliffLips`, `edgeHazards`).
    - Rigid mode: still passes reachability, ramp-count, monolith, cover-count, and role assertions.
    - Default mode: ramp count still spans 4–5 across a seed sweep (prove rigid is not accidentally the default path).
  - Call `generateLayout(seed, 'sunken-canyon', { layoutMode: 'rigid' })` directly; no `quests.js` changes required yet.
- **`game/server/test/sunken_canyon_walkability.test.js`** (only if helpers need `{ layoutMode: 'rigid' }` for new rigid-only regressions).

## Verification: code
