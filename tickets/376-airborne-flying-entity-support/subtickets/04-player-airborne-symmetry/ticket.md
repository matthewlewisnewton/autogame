# Player airborne symmetry (snapshot + floor-aware render + shadow)

Make the PLAYER entity path airborne-capable in the same symmetric, general way
that flying enemies and minions already are, so a future player fly/hover card
that sets `player.flying = true` (with an optional `player.altitude`) renders the
local AND remote player at altitude with a ground shadow — instead of snapping to
the floor. Reuse the existing generic helpers (`resolveEntityY` on the server;
`flyingRenderOffset` / `flyingShadowY` / `syncFlyingShadow` on the client); do not
add a player-only altitude code path.

## Acceptance Criteria

- The player hot snapshot exposes `flying` (boolean) and `altitude` (number)
  fields derived from the server player object, so the client can tell a flying
  player from a grounded one. A grounded player (no `flying` flag) reports
  `flying: false`/falsy and continues to broadcast its existing floor `y`.
- The LOCAL player render path no longer hard-snaps to
  `resolveFloorY(sampleFloorY(layout, myX, myZ))` unconditionally. When the local
  player is flying it renders at the floor-aware airborne height using
  `flyingRenderOffset(localPlayerEntity, layout)` (so on a raised floor it is
  `floorY + altitude`); when grounded it renders at the sampled floor exactly as
  before (offset 0 → no behavior change for the current non-flying game).
- The REMOTE player render path renders flying remote players at their
  floor-aware airborne height (reusing `flyingRenderOffset`) instead of the bare
  `pData.y || 0.5`; grounded remote players are unchanged.
- A ground shadow is created beneath a flying player (local and remote) using the
  existing `syncFlyingShadow` shadow path with a dedicated `playerShadows` map,
  positioned on the sampled floor via `flyingShadowY`, and disposed when the
  player is no longer flying. No shadow exists for grounded players.
- Nameplate / health-bar / VFX anchors that follow the player mesh continue to
  track the rendered (airborne) mesh position, so they stay attached when the
  player is airborne.
- Server test: a player object flagged `{ flying: true, altitude }` resolves to
  `floorY + altitude` via `resolveEntityY` and its built hot snapshot carries the
  `flying`/`altitude` fields; a grounded player resolves to floor height and
  reports a falsy `flying`.
- Client test: `flyingRenderOffset` applied to a flagged player entity returns the
  floor-aware altitude offset (raised floor → `(floorY - DEFAULT_FLOOR_Y) + altitude`)
  and `0` for a grounded player, proving the player reuses the same airborne helper
  as enemies/minions.

## Technical Specs

- `game/server/progression.js`: in `buildPlayerHotSnapshot(id, p)` add
  `flying: !!p.flying` and `altitude: Number.isFinite(p.altitude) ? p.altitude : 0`
  (or pass through `p.altitude`) alongside the existing `x/y/z`. This is the only
  server change needed — `simulation.js` already resolves player `y` through
  `resolveEntityY(player, layout)`.
- `game/client/renderer.js`:
  - Local player block (~line 6357): build a player-shaped entity for the helper
    (e.g. `{ flying: me?.flying, altitude: me?.altitude, x: myX, z: myZ }`) and set
    the mesh Y to `floorY + flyingRenderOffset(thatEntity, layout)` where `floorY`
    remains the sampled floor — so grounded players keep the current value and
    flying players rise to altitude. Do NOT change myX/myZ prediction logic.
  - Remote player block (~line 6322): replace `pData.y || 0.5` with a floor-aware
    airborne height — e.g. base it on `pData.y` (the server already broadcasts the
    resolved airborne `y`) or add `flyingRenderOffset(pData, gs.layout)` to the
    floor — keeping grounded remote players visually unchanged.
  - Add a module-level `const playerShadows = {};` map (mirroring `enemyShadows`
    / `minionShadows`) and call `syncFlyingShadow(playerShadows, <playerEntity>, gs.layout)`
    for each player in the render loop (local + remote), so flying players get a
    ground shadow and grounded players get none. Use `pData.x/pData.z` for remote
    players and `myX/myZ` for the local player. Ensure the shadow is disposed on
    player removal alongside the other player-keyed maps.
  - Keep using the already-exported `flyingRenderOffset` / `flyingShadowY` and the
    existing `syncFlyingShadow` helper — do not duplicate altitude math.
- `game/server/test/airborne.test.js`: add cases asserting `resolveEntityY` for a
  flying player object and that `buildPlayerHotSnapshot` (import/export it if not
  already reachable) includes `flying`/`altitude`.
- `game/client/test/airborne-floor-render.test.js`: add a case feeding a
  player-shaped flying entity to `flyingRenderOffset` (raised + flat floor) and a
  grounded player asserting offset `0`.

## Verification: code
