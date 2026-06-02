# Smoke Bomb — Client Smoke VFX

Render a smoke/fog cloud in the 3D scene at an active smoke zone's position so
players can see where the zone is. The VFX is driven by the per-player
`smokeBombUntil`/`smokeBombRadius`/`smokeBombX`/`smokeBombZ` fields broadcast in
`stateUpdate` (sub-ticket 01), so it appears for the caster AND for allies who
can see the zone, and is removed when the zone expires.

## Acceptance Criteria

- A new exported VFX function in `game/client/renderer.js` (e.g.
  `triggerSmokeBombVFX(position, radius)` plus an internal registry like the
  existing `shieldVFX` / heal-pulse helpers) creates a semi-transparent
  smoke/fog mesh (or particle puff) at the given world position sized to the
  zone radius, sitting near the floor.
- The smoke VFX is shown while any visible player has an active smoke zone
  (`smokeBombUntil > now`) and is removed/faded out once the zone expires; it
  does not linger indefinitely or stack duplicates for the same zone.
- `game/client/main.js` drives the VFX from `stateUpdate`: when a player's
  `smokeBombUntil` is in the future, it ensures the smoke VFX exists at
  `(smokeBombX, smokeBombZ)` with `smokeBombRadius`; when it has expired it lets
  the VFX clean up. Follow the established pattern used for shield/heal-pulse
  VFX (imported from `renderer.js`, invoked from the per-state render path).
- The effect renders for BOTH the local player's own zone and an ally's zone
  (any player in the snapshot with an active `smokeBombUntil`), since the zone
  is fixed at its cast point.
- No errors are thrown when a player has no active smoke zone (fields 0/absent),
  and existing VFX (dash, shield, heal pulse) continue to work unchanged.
- A client test (e.g. `game/client/test/` — add or extend an existing renderer
  test) asserts `triggerSmokeBombVFX` is exported and, when called, adds a mesh
  to the scene/registry (and that the registry entry is cleaned up on
  expiry/removal). Mock Three.js the same way the existing renderer tests do.

## Technical Specs

- `game/client/renderer.js`:
  - Add `triggerSmokeBombVFX(position, radius)` and a module-level registry
    (e.g. `const smokeBombVFX = {}` keyed by zone owner playerId), modeled on the
    `shieldVFX` block around lines 1111-1231 and the heal-pulse helper around
    line 1120. Build the mesh from the project's existing Three.js import; use a
    translucent material and dispose geometry/material on cleanup.
  - Provide a way to remove/fade the VFX when the zone is gone (mirror how
    `shieldVFX` entries are removed in the render loop around line 2766-2782).
- `game/client/main.js`:
  - Import `triggerSmokeBombVFX` alongside the other VFX imports (around line
    135-137) and, in the per-`stateUpdate` render path, iterate visible players
    and ensure/clean up the smoke VFX based on each player's `smokeBombUntil`
    and `smokeBombX`/`smokeBombZ`/`smokeBombRadius`.
- Do NOT change server logic; rely on the snapshot fields added in sub-ticket
  01. Keep movement/auth/lobby flows untouched.

## Verification: code
