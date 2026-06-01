# Client: Field Medic Kit — green pulse VFX

When the caster uses `field_medic_kit`, spawn a brief green expanding ring (or hemisphere) at the caster's 3D position to visualize the heal pulse. The effect lasts ~600 ms and fades out.

## Acceptance Criteria

- A new `triggerHealPulseVFX(position)` function exists in `game/client/renderer.js`.
- The function creates a green ring mesh (TorusGeometry or RingGeometry) at the caster's `(x, y, z)`, colored with the theme's heal green or a hardcoded `#44ff44`.
- The ring expands from radius 0 to `healRadius` (5 m) over ~400 ms, then fades out over ~200 ms.
- After the animation completes, the mesh is removed from the scene and geometry/material are disposed.
- `triggerHealPulseVFX` is called from `game/client/main.js` when a `keyItemUsed` event arrives with `ok: true` and `keyItemId === 'field_medic_kit'`.

## Technical Specs

| File | Change |
|---|---|
| `game/client/renderer.js` | Add `triggerHealPulseVFX({ x, y, z })` — creates a green ring at floor level, animates scale+opacity, cleans up. Follow the same pattern as `triggerDashVFX` (spawn → animate in render loop → dispose). |
| `game/client/main.js` | In the `keyItemUsed` socket handler (~line 2237 area), when `data.keyItemId === 'field_medic_kit'` and `data.ok`, call `triggerHealPulseVFX` with the caster's current position from the latest `stateUpdate`. |

## Verification: visual
