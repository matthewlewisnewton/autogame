# Smoke Bomb — client fog VFX

Render a short-lived smoke/fog VFX at the player's feet when a `smoke_bomb`
`keyItemUsed { ok: true }` event arrives, mirroring the existing key-item VFX
pattern (heal pulse / shield). Visual QA's happy-path run never uses a key item,
so this is verified by reading the code, not a screenshot.

## Acceptance Criteria

- A `triggerSmokeBombVFX(position)` (or equivalent) function is exported from
  `game/client/renderer.js` and creates a translucent grey fog VFX (a Three.js
  mesh — e.g. a flattened sphere or a stack of soft discs) centered at the given
  ground position, added to the `scene`.
- The VFX is transient: it fades out and is removed from the scene (with
  `geometry.dispose()` / `material.dispose()`) after roughly the smoke duration
  (~2s), following the same `requestAnimationFrame` fade-and-cleanup pattern as
  `triggerHealPulseVFX`.
- In `game/client/main.js`, the `keyItemUsed` handler (~line 1098) calls the new
  VFX function when `data.ok && data.keyItemId === 'smoke_bomb'`, positioned at
  the caster's current location (`gameState.players[myId]` → `{ x, y: 0, z }`),
  consistent with how `field_medic_kit` resolves the caster position.
- The VFX function guards against a missing `scene` (early-returns) like the
  other `trigger*VFX` functions, so it cannot throw when the renderer is not
  initialized.
- No regression to existing key-item VFX wiring (`field_medic_kit`,
  `guard_block`).

## Technical Specs

- `game/client/renderer.js`: add and export `triggerSmokeBombVFX(position)` next
  to `triggerHealPulseVFX`/`triggerShieldVFX` (~line 1120-1200). Use a
  translucent grey `MeshStandardMaterial` (`transparent: true`, `depthWrite:
  false`); define a smoke color constant near the other VFX color constants.
  Animate opacity down over ~2000ms via `requestAnimationFrame`, then
  `scene.remove(mesh)` and dispose geometry/material.
- `game/client/main.js`: import `triggerSmokeBombVFX` alongside the other VFX
  imports (~line 135) and call it inside the existing `s.on('keyItemUsed', ...)`
  `data.ok` branch (~line 1100) for `data.keyItemId === 'smoke_bomb'`, resolving
  the caster via `const me = myId && gameState?.players ? gameState.players[myId] : null;`
  and passing `{ x: me.x, y: 0, z: me.z }`.

## Verification: code
