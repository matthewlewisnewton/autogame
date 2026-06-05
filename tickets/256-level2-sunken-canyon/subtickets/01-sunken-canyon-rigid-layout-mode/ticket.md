# 01 — Sunken-canyon rigid layout mode

Extend the reusable `layoutMode: 'rigid'` option from ticket 254 to the `sunken-canyon` profile so Tier-2 runs can use a seed-stable canyon geometry while preserving all existing canyon identity features (plateau/canyon/ramp bands, cliff lips, edge hazards, monolith landmark, start/treasure roles, ramp linkage).

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon', options)` threads `layoutMode` into `generateSunkenCanyon(seed, options)`; unknown modes fall back to `'default'`.
- In `'default'` mode, current behavior is unchanged: ramp count varies 4–5 across seeds (2–3 central ramps plus west/east edge connectors) and cover/monolith placement uses RNG scatter.
- In `'rigid'` mode, structural RNG is removed: fixed ramp configuration, ordered cover placement, and a fixed monolith position produce layouts that are identical across different seeds (or differ only in fields explicitly documented as seed-driven cosmetics — there should be none for rigid sunken-canyon).
- Rigid layouts still satisfy all sunken-canyon invariants: `profile: 'sunken-canyon'`, flat plateau and canyon bands with `yDrop ≥ 8`, `cliffLips` and `edgeHazards` present, plateau=start / canyon=treasure roles, full foot reachability from plateau to canyon floor, and no enemies-on-ramp regressions.
- `getLayoutGenerationOptions('canyon_descent', 1)` continues to return `{ slopes: true, layoutMode: 'default' }` (no quest-tier change in this sub-ticket).
- Unit tests in `game/server/test/dungeon.test.js` prove rigid determinism across seeds and that default mode still varies ramp count; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/dungeon.js`**
  - Change `generateLayout` sunken-canyon branch to `return generateSunkenCanyon(seed, options)`.
  - Update `generateSunkenCanyon(seed, options = {})` to read `normalizeLayoutMode(options.layoutMode)`.
  - Add rigid constants on `SUNKEN_CANYON` (e.g. fixed central ramp count / ramp centers) used only when `layoutMode === 'rigid'`; keep existing `mulberry32` rolls for `'default'`.
  - In `'rigid'` mode, replace `scatterCoverInArena` with `placeCoverInArenaOrdered` (reuse existing helper; pass canyon center offsets) and pin monolith placement (fixed position/yaw or first ordered candidate without shuffle).
  - Do **not** alter `buildSunkenCanyonCliffLips`, `buildSunkenCanyonCliffHazards`, ramp room builders, or role assignment logic — rigid mode only pins values that are currently RNG-driven.
- **`game/server/test/dungeon.test.js`**
  - New cases under the existing `generateLayout(seed, 'sunken-canyon')` describe block:
    - Rigid mode: two different seeds yield deep-equal structural geometry (`rooms`, `cover`, `cliffLips`, `edgeHazards`, `landmarks`).
    - Rigid mode: still passes reachability, band, cliff-hazard, and role assertions.
    - Default mode: ramp count still varies across a seed sweep (prove rigid is not accidentally the default path).
  - Call `generateLayout(seed, 'sunken-canyon', { layoutMode: 'rigid' })` directly; no `quests.js` changes required yet.

## Verification: code
