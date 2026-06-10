# Client airborne render + shadow honor non-default floor height

Flying enemies/minions currently render their altitude relative to the default
floor plane and their ground shadow is pinned to the constant `GROUND_OVERLAY_Y`,
so on rooms whose floor surface differs from `DEFAULT_FLOOR_Y` (slopes / raised /
multi-level floors) fliers float at the wrong height and their shadow detaches
from the actual floor under them. Make the flier render Y and shadow Y derive
from the server-authoritative world Y (`entity.y`) — equivalently
`sampleFloorY(layout, entity.x, entity.z) + altitude` — while leaving grounded
entity placement byte-for-byte unchanged. Applies symmetrically to flying
enemies and flying minions.

## Acceptance Criteria
- For a flying entity on a non-default floor (where
  `sampleFloorY(layout, x, z) !== DEFAULT_FLOOR_Y`), the computed render base
  Y tracks the floor surface beneath the flier plus its altitude — i.e. the
  flier rises/falls with the floor, not relative to a fixed default plane. On
  the default floor the render Y is unchanged from the current behavior.
- The altitude helper prefers the server-authoritative world Y (`entity.y`):
  when `entity.y` is finite it is used directly as the floor-aware world Y, so a
  non-default floor height carried in `entity.y` is honored. The bare
  `entity.altitude` fallback is combined with the sampled floor surface so it is
  also floor-aware rather than assuming the default plane.
- A flying entity's ground shadow is positioned at the sampled floor surface
  under the flier (`sampleFloorY(layout, entity.x, entity.z)` + the same small
  overlay offset that `GROUND_OVERLAY_Y` adds to `FLOOR_Y`), not at the constant
  `GROUND_OVERLAY_Y`, so on a non-default floor the shadow sits on the floor
  directly below the flier.
- Health bar and shield bar Y offsets for a flying enemy continue to be computed
  from the flier's (now floor-aware) render Y, so they stay above the airborne
  body on non-default floors.
- Grounded enemies and grounded minions are completely unchanged: the
  floor-aware path is taken ONLY when `entity.flying` is set.
- A new client unit test exercises the floor-aware altitude/shadow computation
  for a flying enemy AND a flying minion placed on a non-default floor height,
  asserting the render Y and shadow Y include the floor offset; and asserts a
  grounded entity on the same floor still returns the unchanged base.
- Existing client tests / smoke tests still pass.

## Technical Specs
- `game/client/renderer.js`:
  - Make `flyingAltitude(entity)` (≈ line 3658) floor-aware, or introduce a
    floor-aware companion (e.g. `flyingRenderOffset(entity, layout)`), so the
    returned offset accounts for the floor surface at `(entity.x, entity.z)`:
    use `sampleFloorY(layout, entity.x, entity.z)` (already imported from
    `./collision.js`) relative to `FLOOR_Y`/`DEFAULT_FLOOR_Y` so the flier base
    follows the floor. Prefer `entity.y` when finite (it is the
    server-authoritative world Y); otherwise combine `entity.altitude` with the
    sampled floor surface.
  - Enemy mesh sync (≈ line 6498): `renderY` must use the floor-aware offset and
    pass the active `layout` (the render block already has `const layout =
    gs && gs.layout` ≈ line 6342 / `gameStateRef?.layout`). Keep grounded
    placement (`halfHeight`) identical when not flying.
  - Minion mesh sync (≈ line 6728): apply the same floor-aware offset to
    `minionRenderY` (and the `spawnDamageNumber` altitude at ≈ line 6783).
  - `syncFlyingShadow(shadowMap, entity)` (≈ line 3685): position the shadow at
    `sampleFloorY(layout, entity.x, entity.z) + (GROUND_OVERLAY_Y - FLOOR_Y)`
    instead of the constant `GROUND_OVERLAY_Y`; thread `layout` into the call
    sites (enemy ≈ 6500, minion ≈ 6730). Grounded-entity disposal path
    unchanged.
  - Export the floor-aware altitude helper (and/or a shadow-Y helper) so it can
    be unit tested in isolation (mirror the existing `export function` helpers
    near the top of `renderer.js`).
- `game/client/test/` — add a test file (e.g. `airborne-floor-render.test.js`)
  following the existing `client/test/renderer-*.test.js` pattern that imports
  the exported helper(s) and asserts floor-aware render/shadow Y for a flying
  enemy and a flying minion on a non-default floor, plus the unchanged grounded
  result. Build a minimal `layout` whose `sampleFloorY` returns a non-default
  height (mirror the floor setup used by `server/test/airborne.test.js` /
  `client/test/shared-floor-sampling.test.js`).
- Do NOT change server code, and do NOT touch the already-passed sub-tickets
  `01-server-airborne-altitude-model` or `02-client-airborne-render-shadow`
  beyond this floor-awareness fix in `renderer.js`.

## Verification: code
