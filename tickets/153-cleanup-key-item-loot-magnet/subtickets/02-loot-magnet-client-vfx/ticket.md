# Loot magnet client VFX on successful use

Other key items get item-specific client feedback (`flashKeyItemIndicator` plus dedicated VFX for medic kit heal pulse and guard block shield). Loot magnet currently only gets the generic success flash from `keyItemUsed`. Add a brief, client-only visual hint when the magnet actually pulls loot.

## Acceptance Criteria

- On successful `keyItemUsed` with `keyItemId === 'loot_magnet'` and `pulled > 0`, the client shows a short VFX at the local player (e.g. expanding ring / magnet pulse), in addition to the existing success indicator flash.
- When `pulled === 0` (empty use), no loot-magnet-specific VFX runs — only the generic success flash from `flashKeyItemIndicator('success')` if the server still returns `ok: true`.
- No new server socket fields or events; use existing `keyItemUsed` payload (`pulled`, `collected`).
- VFX helper is exported from `renderer.js` and invoked from the `keyItemUsed` handler in `main.js`, following the same pattern as `triggerShieldVFX` / `triggerSmokeVFX`.
- Geometries/materials are disposed after the animation completes (no leak per cast).

## Technical Specs

- **`game/client/renderer.js`**
  - Add `triggerLootMagnetVFX(position)` (or similar name): brief gold/amber expanding ring or pulse at the player’s world position, ~400–800ms, aligned with existing heal/shield VFX style (`THREE.RingGeometry`, `requestAnimationFrame`, dispose on complete).
  - Optional: scale pulse radius loosely from `keyItemDefs.loot_magnet?.attractRadius` (8m default) for visual consistency — still client-only, no server change.
- **`game/client/main.js`**
  - Import the new trigger alongside `triggerShieldVFX` / `triggerSmokeVFX`.
  - In the `s.on('keyItemUsed', ...)` success branch, after `flashKeyItemIndicator('success')`, add:
    - `if (data.keyItemId === 'loot_magnet' && (data.pulled ?? 0) > 0)` → resolve local player position from `gameState.players[myId]` and call the new VFX.
- **`game/client/test/main.test.js`** (optional but preferred if nearby tests mock socket events)
  - Add a small unit test that firing `keyItemUsed` with `loot_magnet` and `pulled: 1` calls the VFX helper (spy/mock), and `pulled: 0` does not.
- **Do not change** server files for this sub-ticket.

## Verification: code
