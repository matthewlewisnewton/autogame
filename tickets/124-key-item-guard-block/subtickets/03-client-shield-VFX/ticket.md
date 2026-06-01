# 03 — Client: Shield VFX on blocking

Render a visual shield indicator in front of the player when the guard block is active, and wire the blocking state from server to client.

## Acceptance Criteria

- Server sends `isBlocking` boolean in `stateSnapshot()` (alongside existing `isInvulnerable`)
- When the local player is blocking, a translucent shield disc or dome renders in front of the player mesh, oriented along the player's facing direction
- Shield VFX disappears automatically when `blockingUntil` expires (driven by server state)
- On `keyItemUsed` response for `guard_block`, the client triggers the shield VFX (consistent with how `field_medic_kit` triggers a heal pulse)

## Technical Specs

- **server/progression.js** (`stateSnapshot`, ~line 2991): Add `isBlocking: Date.now() < (p.blockingUntil || 0)` to each player's snapshot entry (next to `isInvulnerable`)
- **client/renderer.js**: Create `triggerShieldVFX(playerId)` function that:
  - Creates a semi-transparent disc or hemisphere mesh positioned in front of the player
  - Oriented along the player's `rotation` (yaw)
  - Uses a cyan/blue emissive material (consistent with game's color palette — check `theme.json`)
  - Auto-removes after ~800ms (slightly longer than block duration to avoid flicker)
  - Follows the same pattern as `triggerDashVFX` (ghost clone that fades)
- **client/renderer.js**: In the per-frame render loop, if `me.isBlocking`, ensure shield VFX is visible (re-trigger if expired, similar to how invulnerability shimmer is applied each frame at ~line 2580)
- **client/main.js** (~line 1088, `keyItemUsed` handler): Add case for `guard_block` to call `triggerShieldVFX(myId)`

## Verification: code
