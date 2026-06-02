# Spire Ascent Layout Generator

Implement `generateLayout(seed, profile, { stage: 'spire-ascent' })` to produce a deterministic vertical tower of 3–5 stacked tiers connected by ramp passages, with perimeter walls and role metadata (start at bottom, treasure at top).

## Acceptance Criteria

- `generateLayout(seed, profile, { stage: 'spire-ascent' })` returns a layout distinct from the default grid generator (early-return or dedicated `generateSpireAscentLayout(seed)` branch).
- Layout contains **3–5 tiers** (rooms), each room-sized (~12–15 unit width/depth). Tier `n` has a strictly greater base floor Y than tier `n-1` (compare average of `floorCorners` or a `tierBaseY` field).
- Consecutive tiers are linked by exactly one ramp passage each, built via `buildRampPassage` from sub-ticket 01. Every ramp has average slope ≥ 0.2.
- Total Y gain from spawn (start tier center) to top tier center ≥ 10 units.
- Every tier has outer perimeter walls with no walk-off gaps; ramp passages have side walls. No orphan tier — all tiers reachable from tier 0 via the passage graph.
- `assignRoomRoles` (or spire-specific role assignment): index 0 → `start`, highest tier → `treasure`, intermediates → `combat`. Each room gets `tierIndex` (0-based) for downstream spawn logic.
- Same seed produces deep-equal layouts across runs.
- Unit tests in `dungeon.test.js`: tier count in [3,5], monotonic tier Y, ramp slope bounds, total Y gain ≥ 10, BFS reachability from start to every tier, no duplicate/orphan tiers.

## Technical Specs

- **Files:** `game/server/dungeon.js`, `game/server/test/dungeon.test.js`.
- **Topology:** linear chain tier₀ → ramp → tier₁ → … → tierₙ (simplest valid spire). Stack tiers along +Z with shared X center so ramps run north–south; raise `floorCorners` uniformly per tier (flat platforms).
- **Tier sizing:** reuse `MIN_ROOM_SIZE` / `MAX_ROOM_SIZE_INCLUSIVE` constants; pick per-tier dimensions with the layout seed RNG.
- **Ramp budget:** divide total rise (≥ 10) across `tierCount - 1` ramps; call `buildRampPassage` with per-ramp `rise` and `minSlope: 0.2`.
- **Passages array:** only ramp passages between consecutive tiers (no grid-style extra edges).
- **Options API:** accept `options.stage === 'spire-ascent'` (string); ignore `profile` grid params for this stage except `passageWidth`.
- Export any new pure helpers (e.g. `computeTierBaseY`, `validateSpireLayout`) for tests.

## Verification: code
