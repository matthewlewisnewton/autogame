# sampleFloorY null-layout guard and platform floorCorners fallback

`sampleFloorSurface` already returns early when `layout` is null, but `sampleFloorY` dereferences `layout.platforms` / `layout.rooms` without a guard, causing a TypeError on null layout in server tick and client movement-prediction paths. The platform branch also reads `platform.floorCorners.yNW` unguarded while the room branch falls back to `DEFAULT_FLOOR_Y` per corner. Harden `sampleFloorY` with the same null guard and platform corner fallbacks, and lock the behavior in with unit tests.

## Acceptance Criteria

- `sampleFloorY(null, x, z)` returns `DEFAULT_FLOOR_Y` (0.5) and does not throw for any finite `x`, `z`
- `sampleFloorY` on a layout whose platform contains `(x, z)` but omits `floorCorners` returns `DEFAULT_FLOOR_Y` at that point and does not throw
- Existing sloped-room and open-plaza platform interpolation behavior is unchanged when `floorCorners` is present
- Unit tests in both server and client vitest suites cover the null-layout and missing-platform-`floorCorners` cases
- `game/shared/floorSampling.js` is not edited (CJS bridge evals the `.esm.js` source at load time)

## Technical Specs

**`game/shared/floorSampling.esm.js`** — only file that needs a logic change:

- At the top of `sampleFloorY(layout, x, z)`, add an early return before any `layout` dereference:
  `if (!layout) return DEFAULT_FLOOR_Y;`
  (Use `DEFAULT_FLOOR_Y`, not `null`, so callers that skip `resolveFloorY` are safe.)
- Inside the platform containment branch (where `const fc = platform.floorCorners` is already assigned), mirror the room branch's per-corner fallback:
  ```js
  const yNW = fc ? fc.yNW : DEFAULT_FLOOR_Y;
  const yNE = fc ? fc.yNE : DEFAULT_FLOOR_Y;
  const ySE = fc ? fc.ySE : DEFAULT_FLOOR_Y;
  const ySW = fc ? fc.ySW : DEFAULT_FLOOR_Y;
  ```
  and use `yNW`…`ySW` in the bilinear interpolation instead of `fc.yNW`…`fc.ySW`.

**`game/server/test/dungeon.test.js`** — extend the existing `describe('sampleFloorY(layout, x, z)', …)` block:

- Add `it('returns DEFAULT_FLOOR_Y for null layout', …)` calling `sampleFloorY(null, 0, 0)` (and optionally a second coordinate).
- Add `it('returns DEFAULT_FLOOR_Y for platform lacking floorCorners', …)` with a minimal layout `{ rooms: [], platforms: [{ x: 0, z: 0, width: 10, depth: 10 }] }` and assert center `(0, 0)` yields `DEFAULT_FLOOR_Y`.

**`game/client/test/shared-floor-sampling.test.js`** — add matching edge-case tests (this file imports `floorSampling.esm.js` directly):

- Null layout returns `DEFAULT_FLOOR_Y`.
- Platform without `floorCorners` returns `DEFAULT_FLOOR_Y` at platform center.

## Verification: code
