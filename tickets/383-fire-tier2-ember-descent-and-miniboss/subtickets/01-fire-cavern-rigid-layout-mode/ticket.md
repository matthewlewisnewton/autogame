# 01 — Fire-cavern rigid layout mode

Extend the reusable `layoutMode: 'rigid'` option from ticket 254 to the `fire-cavern` profile so Ember Descent Tier II runs use seed-stable volcanic geometry while preserving all existing fire-cavern identity features (rim/basin bands, 2–3 ramp mouths, basin cover, ember-vent entry decor, rim→basin reachability).

## Acceptance Criteria

- `generateLayout(seed, 'fire-cavern', options)` threads `layoutMode` into `generateFireCavern(seed, options)`; unknown modes fall back to `'default'`.
- In `'default'` mode, current behavior is unchanged: central ramp count varies 2–3 across seeds, cover scatter and entry-decor placement remain seed-driven.
- In `'rigid'` mode, structural RNG is removed: fixed ramp selection, ordered cover placement, and fixed entry-decor count produce layouts that are identical across different seeds (or differ only in fields explicitly documented as seed-driven cosmetics — there should be none for rigid fire-cavern).
- Rigid layouts still satisfy all fire-cavern invariants: `profile: 'fire-cavern'`, rim=start / basin=treasure / ramps=connector, Y drop ≥ 8, perimeter walls, basin cover pieces, ember-vent entry decor, and full foot reachability from rim to basin.
- `getLayoutGenerationOptions('ember_descent', 1)` continues to return `{ slopes: true, layoutMode: 'default' }` (no quest-tier change in this sub-ticket).
- Unit tests in `game/server/test/dungeon.test.js` prove rigid determinism across seeds and that default mode still varies ramp count; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/dungeon.js`**
  - Update `generateFireCavern(seed, options = {})` to read `normalizeLayoutMode(options.layoutMode)`.
  - Add rigid constants on `FIRE_CAVERN` (e.g. `rigidRampCount: 3` using all three `rampXOffsets`, fixed cover target count, fixed entry-decor count) used only when `layoutMode === 'rigid'`.
  - Rigid path: pin `numRamps` / `rampCenters`; replace `scatterCoverInArena` with `placeCoverInArenaOrdered` (same basin candidate pool as default); replace entry-decor RNG count with a fixed count.
  - Do **not** alter rim/basin room builders, ramp room builders, or band/role assignment — rigid mode only pins values that are currently RNG-driven.
- **`game/server/test/dungeon.test.js`**
  - New cases under the existing `generateLayout(seed, 'fire-cavern')` describe block:
    - Rigid mode: two different seeds yield deep-equal structural fields (`rooms`, `cover`, `entryDecor`).
    - Rigid mode: still passes reachability, ramp-count, cover-count, band/role, and rim→basin assertions.
    - Default mode: ramp count still spans 2–3 across a seed sweep (prove rigid is not accidentally the default path).
  - Call `generateLayout(seed, 'fire-cavern', { layoutMode: 'rigid' })` directly; no `quests.js` changes required yet.
- **`game/server/test/fire_cavern_walkability.test.js`** (only if helpers need `{ layoutMode: 'rigid' }` for new rigid-only regressions).

## Verification: code
