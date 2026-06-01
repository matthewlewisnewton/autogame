# 02 — Client: enemy highlight VFX for revealed enemies

When the server sets `revealedUntil` on enemies (via Flare Beacon), the client highlights those enemies with an emissive glow for the duration.

## Acceptance Criteria

- Enemies with `revealedUntil > Date.now()` display a bright emissive glow on their mesh (amber/orange color, e.g. `0xffaa00`)
- The glow is applied each frame in the enemy sync loop, persisting until `revealedUntil` expires
- Once `revealedUntil` expires (or is removed by server), the emissive is restored to the enemy's default color
- The highlight works for all enemy types (grunt, skirmisher, miniboss, spawner)
- No highlight is applied when `revealedUntil` is absent, 0, or in the past

## Technical Specs

**Files to modify:**

- `game/client/renderer.js`
  - In the enemy mesh sync loop (around line 2705, inside the `for (const enemy of gs.enemies)` block in the animation frame callback):
    - After the existing `enemiesMeshes[enemy.id].position.set(...)` line, add reveal highlight logic:
    - If `enemy.revealedUntil && performance.now() < enemy.revealedUntil`:
      - Set `mesh.material.emissive.set(0xffaa00)` (amber glow)
      - Store the original emissive color on the mesh if not already stored (e.g., `mesh._origEmissive`)
    - Else:
      - Restore `mesh.material.emissive.set(mesh._origEmissive || 0x000000)`
  - Capture `_origEmissive` when creating the enemy mesh in `createEnemyMesh()`: after `mesh.material = new MeshStandardMaterial(...)`, set `mesh._origEmissive = 0x000000` (or whatever the default emissive is)
  - Be careful not to conflict with existing `flashMesh` calls (damage feedback uses emissive too). The reveal glow should be applied **after** any flash, so it takes priority while active. Alternatively, scale the existing emissive rather than overwriting.

**Implementation note:** The `flashMesh` function temporarily sets emissive and restores after a timeout. To avoid conflicts, the reveal highlight should either:
  - (a) Store/restore its own copy of the emissive each frame, or
  - (b) Check if a flash is active and skip the reveal glow during flash, or
  - (c) Use a separate approach — e.g., a child mesh with emissive material overlaid on the enemy

  Approach (a) is simplest: each frame, if revealed, set emissive to amber; otherwise restore to `_origEmissive`. Flash calls will be overwritten by the reveal glow on the next frame, which is acceptable (reveal glow > damage flash).

## Verification: code
