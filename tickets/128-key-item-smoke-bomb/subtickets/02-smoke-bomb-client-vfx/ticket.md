# Smoke Bomb — Client Smoke VFX

Render a smoke/fog puff at the smoke zone when `smoke_bomb` is cast, so players can
see the concealment field. The VFX appears at the cast point, persists for roughly
the zone duration, and fades out — mirroring how Guard Block / Heal Pulse VFX are
wired through the `keyItemUsed` handler and `stateUpdate`.

> Note: the happy-path smoke-test run (load + two players join + WASD) never casts a
> key item, so no smoke is visible there — this is `code`-verified by confirming the
> VFX function and its wiring exist, not by a screenshot.

## Acceptance Criteria

- `renderer.js` exports a `triggerSmokeVFX(position)` (or equivalently named)
  function that creates a translucent smoke/fog mesh at the given world position,
  lasting ~2s and fading out before being disposed/removed from the scene.
- `main.js` imports the new function and, in the `keyItemUsed` handler (~line 1110),
  triggers the smoke VFX at the local player's position when
  `data.ok && data.keyItemId === 'smoke_bomb'`.
- Remote/other players' smoke is also shown: when a player's `smokeBombUntil` is in
  the future in the `stateUpdate` snapshot, the smoke VFX is rendered for that
  player's zone (re-trigger-if-absent pattern, like the Guard Block shield VFX at
  renderer.js ~line 3055).
- The smoke mesh is cleaned up (geometry/material disposed, removed from the scene,
  and any per-player tracking entry cleared) after it fades; no leak across repeated
  casts.

## Technical Specs

- `game/client/renderer.js` — add a smoke VFX module near the existing
  `triggerShieldVFX` / `triggerHealPulseVFX` helpers (~lines 1385-1512): a
  per-player `smokeVFX` tracking map, a `triggerSmokeVFX(position)` exported
  function building a soft translucent puff (e.g. a low-opacity sphere/sprite or
  small particle cluster) with a timed fade + dispose. Add the re-trigger-while-
  active hook in the per-player update loop (~line 3055) keyed off
  `player.smokeBombUntil`.
- `game/client/main.js` — add the import alongside `triggerShieldVFX` (~line 138)
  and the `smoke_bomb` case in the `keyItemUsed` handler (~line 1110-1128),
  calling `triggerSmokeVFX({ x, y: 0, z })` for the local player.
- Reuse Three.js objects already imported in `renderer.js`; match the dispose/
  cleanup style of the existing shield/heal VFX so the scene graph stays clean.

## Verification: code
