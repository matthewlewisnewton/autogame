# Smoke Bomb — Client Smoke VFX

Render a ground-level smoke/fog visual effect when a Smoke Veil zone is active,
so players can see the fog cloud at the cast point for its duration.

## Acceptance Criteria

- A new exported `triggerSmokeVFX(position, options)` (or similarly named)
  function exists in `game/client/renderer.js` that creates a translucent
  ground-hugging fog/smoke effect (e.g. a flat semi-transparent disc/puff or
  particle cloud) centered at the given `{x, y, z}` world position, sized to the
  zone radius, and fades out / is removed after the zone duration (~2s).
- The smoke VFX is added to the Three.js scene and cleaned up (mesh disposed /
  removed) when its lifetime ends, following the existing VFX lifecycle pattern
  used by `triggerHealPulseVFX` / `triggerShieldVFX`.
- In `game/client/main.js`, the `keyItemUsed` socket handler (~line 1098)
  triggers the smoke VFX when `data.keyItemId === 'smoke_bomb'` and `data.ok`,
  using the zone position (`data.x`, `data.z`) and `data.radius` / `data.durationMs`
  from the server payload.
- No console errors are thrown when a smoke bomb is used; the VFX trigger is
  guarded against missing fields (falls back to the local player's position if
  the payload omits coordinates).

## Technical Specs

- `game/client/renderer.js`: add `triggerSmokeVFX` near the other key-item VFX
  helpers (`triggerHealPulseVFX` ~line 1401, `triggerShieldVFX` ~line 1457).
  Use a `MeshBasicMaterial`/`MeshStandardMaterial` with `transparent: true` and
  low opacity, or a small particle/sprite cloud; animate opacity down over the
  duration in the existing per-frame VFX update loop, then dispose and remove
  from the scene. Track instances in a module-level map/array like
  `shieldVFX` / `healPulseVFX`.
- `game/client/main.js`: import `triggerSmokeVFX` alongside the existing VFX
  imports (~lines 135-137) and call it inside the `s.on('keyItemUsed', …)`
  handler's `smoke_bomb` case, mirroring the `guard_block` / `field_medic_kit`
  branches (~lines 1098-1110).
- Keep the effect purely cosmetic — all gameplay (zone, accuracy debuff,
  cooldown) is owned by sub-ticket 01.

## Verification: code
