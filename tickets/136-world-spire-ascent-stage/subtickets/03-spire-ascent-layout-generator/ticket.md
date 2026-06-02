# 03 — Spire Ascent layout generator

Implement `generateLayout(seed, profile, { stage: 'spire-ascent' })` as a dedicated vertical tower: 3–5 flat tier rooms stacked in Y, connected by sloped ramp passages, with perimeter walls and deterministic structure tests.

## Acceptance Criteria

- `generateLayout(42, undefined, { stage: 'spire-ascent' })` returns a layout with `stage: 'spire-ascent'`, `rooms.length` between 3 and 5 (one room per tier), and `passages.length === rooms.length - 1` (linear chain).
- Each tier room has uniform `floorCorners` (flat platform); tier `n` platform Y is strictly greater than tier `n-1` (compare average corner height or `tierBaseY` metadata).
- Each connecting passage uses `buildRampFloorCorners` from sub-ticket 01 with average slope ≥ 0.2 and populates passage floor fields from sub-ticket 02.
- Total Y gain from spawn (bottom tier center) to top tier center is ≥ 10 units.
- Every tier has complete outer perimeter walls (no open edges off the spire); ramp openings are the only gaps between tiers.
- BFS over rooms+passages from index 0 reaches every room; no orphan tier.
- `assignRoomRoles` equivalent for spire: index 0 `start`, highest tier `treasure`, others `combat`; each room has numeric `tierIndex` (0 = bottom).
- Same seed produces deep-equal layout; different seeds can differ in tier count (within 3–5) and dimensions.
- New `describe('generateLayout spire-ascent')` tests in `game/server/test/dungeon.test.js` cover all bullets above (including ramp slope and ≥10 Y gain).

## Technical Specs

- **`game/server/dungeon.js`**:
  - Branch early in `generateLayout` when `options.stage === 'spire-ascent'` → `generateSpireAscentLayout(seed, rng)` (private function).
  - Pick tier count `3 + floor(rng() * 3)`; size tiers ~ `MIN_ROOM_SIZE`–`MAX_ROOM_SIZE`; stack along +Z with `cellSpacing` between tier centers; raise `tierBaseY` by ≥ `10 / (tierCount - 1)` per ramp (tune so total ≥ 10).
  - Build ramp passages with `rampGeometry.buildRampFloorCorners`; set passage `floorCorners` + `floorX`/`floorZ`/`floorWidth`/`floorDepth`.
  - Call spire-specific role assignment (bottom start, top treasure).
  - Export any helpers needed by tests (`generateSpireAscentLayout` optional export for tests only).
- **`game/server/rampGeometry.js`**: import from sub-ticket 01.
- **`game/server/test/dungeon.test.js`**: new describe block; reuse `buildAdjacencyMap` / `bfsDistances` for reachability.

## Verification: code
