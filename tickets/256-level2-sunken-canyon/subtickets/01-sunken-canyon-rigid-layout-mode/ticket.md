# 01 — Sunken-canyon rigid layout mode

Extend the reusable `layoutMode: 'rigid'` option from ticket 254 to the `sunken-canyon` profile so Tier-2 runs can use seed-stable plateau/canyon geometry while preserving all existing canyon identity features (plateau overlook, large canyon floor, 4–5 ramp connectors including lateral edge bridges, cliff lips/hazards, monolith landmark, start/treasure roles).

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon', options)` threads `layoutMode` into `generateSunkenCanyon(seed, options)`; unknown modes fall back to `'default'`.
- In `'default'` mode, current behavior is unchanged: central ramp count varies 2–3 across seeds, cover is shuffled via `scatterCoverInArena`, and monolith placement/yaw remain seed-driven.
- In `'rigid'` mode, structural RNG is removed: fixed central ramp count (all three `rampXOffsets` bridges), deterministic ordered cover placement, and fixed monolith position/yaw produce layouts that are identical across different seeds (or differ only in fields explicitly documented as seed-driven cosmetics — there should be none for rigid sunken-canyon).
- Rigid layouts still satisfy all sunken-canyon invariants: `profile: 'sunken-canyon'`, plateau=start / canyon=treasure / ramp=connector, Y drop ≥ 8, ≥ 4 ramps with west/east edge connectors, ≥ 6 canyon cover pieces, `canyon_monolith` landmark, cliff lips and edge hazards, full foot reachability plateau ↔ canyon (centre and lateral edge probes).
- `getLayoutGenerationOptions('canyon_descent', 1)` continues to return `{ slopes: true, layoutMode: 'default' }` (no quest-tier change in this sub-ticket).
- Unit tests in `game/server/test/dungeon.test.js` prove rigid determinism across seeds and that default mode still varies ramp count or cover across a seed sweep; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/dungeon.js`**
  - Change `generateLayout` sunken-canyon branch to `return generateSunkenCanyon(seed, options)`.
  - Update `generateSunkenCanyon(seed, options = {})` to read `normalizeLayoutMode(options.layoutMode)`.
  - Add rigid constants on `SUNKEN_CANYON` (e.g. `rigidCentralRampCount: 3` using all `rampXOffsets`) used only when `layoutMode === 'rigid'`; keep existing `mulberry32` rolls for `'default'` central ramp count.
  - Rigid cover: use `placeCoverInArenaOrdered` (same helper as open-plaza rigid) instead of `scatterCoverInArena`.
  - Rigid monolith: add a fixed-placement path (first valid grid candidate, fixed yaw) — do not shuffle candidates in rigid mode.
  - Do **not** alter `buildSunkenCanyonCliffLips`, `buildSunkenCanyonCliffHazards`, ramp slope math, or role/band assignment — rigid mode only pins values that are currently RNG-driven.
- **`game/server/test/dungeon.test.js`**
  - New cases under the existing `generateLayout(seed, 'sunken-canyon')` describe block:
    - Rigid mode: two different seeds yield deep-equal structural fields (`rooms`, `cover`, `cliffLips`, `edgeHazards`, `landmarks`).
    - Rigid mode: still passes reachability, ramp count, cover count, monolith, and role assertions.
    - Default mode: central ramp count or cover still varies across a seed sweep (prove rigid is not accidentally the default path).
  - Call `generateLayout(seed, 'sunken-canyon', { layoutMode: 'rigid' })` directly; no `quests.js` changes required yet.

## Verification: code
