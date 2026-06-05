# Zig-zag tier X-offsets (spire-ascent layout)

Stagger each spire-ascent tier platform laterally so the ascent reads as a climbing
tower staircase instead of a straight north–south corridor. Ramps must still bridge
consecutive tiers with full foot reachability and existing slope/Y constraints.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` assigns **distinct `x` centres** to tiers
  (not all `x === 0`); successive tiers alternate or step in X so the footprint
  zig-zags while still climbing along −Z.
- Each ramp room connects its adjacent tiers: ramp centre X lies between (or at the
  shared mouth of) the two tier X positions; ramp `floorCorners` and wall gaps
  still align with tier north/south openings.
- All existing spire-ascent invariants still hold: 3–5 tiers, tierCount − 1 ramps,
  monotonic Y by `tierIndex`, ramp average slope ≥ 0.2, total Y gain ≥ 10, explicit
  roles (`start` / `combat` / `treasure` / `connector`), determinism, and **full
  reachability** from bottom spawn to top tier (flood using walkable AABBs + wall
  colliders).
- Non–`spire-ascent` layouts are unchanged.
- Server unit tests in `game/server/test/dungeon.test.js` assert zig-zag X spread
  (e.g. `Math.max(tier.x) - Math.min(tier.x) > 0` for multi-tier seeds) and keep
  the existing reachability/determinism cases green.

## Technical Specs

- **`game/server/dungeon.js`**
  - Extend `SPIRE_ASCENT` with a lateral step constant (e.g. `tierXStep: 4`).
  - In `generateSpireAscent(seed)`, compute per-tier `x` from `tierIndex` (e.g.
    alternating `±tierXStep`, `±2*tierXStep`, …) instead of fixed `rampX = 0`.
  - Position each ramp at the midpoint X (or tier-mouth X) between the two tiers it
    joins; widen ramp `width` or adjust wall gaps if needed so the walkable strip
    connects both footprints.
  - Update `buildTierPerimeterWalls` calls to use each tier's own `x` and the ramp
    mouth X for north/south gaps.
  - Tag each tier with `tierXOffset` (signed lateral offset from base) if useful for
    downstream client work.
- **`game/server/test/dungeon.test.js`**
  - Add cases under the existing `spire-ascent` describe block for lateral spread
    and reachability across zig-zag seeds (include seeds 1, 42, 777, 9999).

## Verification: code
