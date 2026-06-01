# Fix Shield VFX Facing Direction

Align the guard block shield VFX placement with the game's `rotation = atan2(z, x)` convention. Currently the shield is placed using `-sin(yaw), -cos(yaw)` offsets, drawing the shield along the Z axis when the player faces +X. The shield must appear in front of the player's actual facing direction.

## Acceptance Criteria

- Shield disc is positioned in front of the player along the facing direction defined by `rotation = atan2(z, x)`.
- When `blockingYaw: 0` (facing +X), the shield is offset along +X from the player.
- When `blockingYaw: Math.PI/2` (facing +Z), the shield is offset along +Z from the player.
- Shield Y position and emissive color are unchanged.
- Shield follows player rotation every frame during the blocking window.

## Technical Specs

**Files to change:**
- `game/client/renderer.js` — In `triggerShieldVFX` and the render-loop shield update:
  - Compute `yaw` from `playerMesh.rotation.y + Math.PI / 2` (unchanged — converts display rotation to game yaw)
  - Change shield X/Z offset from `-Math.sin(yaw), -Math.cos(yaw)` to `Math.cos(yaw), Math.sin(yaw)` so the shield places in the forward direction matching `dirX = cos(rotation)`, `dirZ = sin(rotation)`
  - Apply to both initial placement (`triggerShieldVFX`) and per-frame update in the render loop

## Verification: visual
