# 01 — Spire-ascent rigid layout mode

Extend the reusable `layoutMode: 'rigid'` option from ticket 254 to the `spire-ascent` profile so Tier-2 runs can use a seed-stable tower geometry while preserving all existing spire identity features (zig-zag tier offsets, combat-tier edge hazards, start/combat/treasure roles, ramp linkage).

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent', options)` threads `layoutMode` into `generateSpireAscent(seed, options)`; unknown modes fall back to `'default'`.
- In `'default'` mode, current behavior is unchanged: tier count varies 3–5 across seeds and tier width/depth are rolled in the 12–15 range.
- In `'rigid'` mode, structural RNG is removed: fixed tier count and fixed tier width/depth produce layouts that are identical across different seeds (or differ only in fields explicitly documented as seed-driven cosmetics — there should be none for rigid spire).
- Rigid layouts still satisfy all spire-ascent invariants: `profile: 'spire-ascent'`, zig-zag lateral tier offsets, `edgeHazards` on every combat tier, bottom=start / top=treasure / middle=combat roles, ramp count = tierCount − 1, full foot reachability from start to summit.
- `getLayoutGenerationOptions('spire_ascent', 1)` continues to return `{ slopes: true, layoutMode: 'default' }` (no quest-tier change in this sub-ticket).
- Unit tests in `game/server/test/dungeon.test.js` prove rigid determinism across seeds and that default mode still varies tier count; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/dungeon.js`**
  - Change `generateLayout` spire branch to `return generateSpireAscent(seed, options)`.
  - Update `generateSpireAscent(seed, options = {})` to read `normalizeLayoutMode(options.layoutMode)`.
  - Add rigid constants (e.g. fixed `tierCount`, `tierWidth`, `tierDepth` on `SPIRE_ASCENT` or inline) used only when `layoutMode === 'rigid'`; keep existing `mulberry32` rolls for `'default'`.
  - Do **not** alter `buildSpireEdgeHazards`, `spireTierXOffset`, ramp placement, or role assignment logic — rigid mode only pins the values that are currently RNG-driven.
- **`game/server/test/dungeon.test.js`**
  - New cases under the existing `generateLayout(seed, 'spire-ascent')` describe block:
    - Rigid mode: two different seeds yield deep-equal tier geometry (`rooms`, `edgeHazards`).
    - Rigid mode: still passes reachability, zig-zag, edge-hazard, and role assertions.
    - Default mode: tier count still varies across a seed sweep (prove rigid is not accidentally the default path).
  - Call `generateLayout(seed, 'spire-ascent', { layoutMode: 'rigid' })` directly; no `quests.js` changes required yet.

## Verification: code
