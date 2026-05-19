# Player Damage Feedback

Show visible feedback when the local player or remote players take damage or die.

## Acceptance Criteria
- The local player mesh flashes red briefly when the player's HP decreases (detected by comparing current HP to previous HP in the `animate` loop).
- Remote player meshes flash red when their HP decreases between state updates.
- Dead players (local and remote) show a distinct visual state — the existing grey color change is sufficient, but verify it still works after changes.
- A `spawnDamageNumber(position, amount, color)` helper exists for floating damage text (used at minimum for the local player).

## Technical Specs
- **File:** `game/client/main.js`
  - Add `spawnDamageNumber(position, amount, color)` — creates a CSS2DObject or a simple sprite with text showing the damage amount, positioned at the given 3D coordinate, fades out and removes itself after ~1 second.
  - In the `animate` loop, track the local player's previous HP. When `me.hp < prevHp`, call `flashMesh(playersMeshes[myId], 0xff0000, 200)` and `spawnDamageNumber` above the player.
  - For remote players: similarly detect HP drop between frames and flash the remote player mesh red.
  - Ensure dead player color (grey `0x808080`) is already applied — it exists in current code, just verify it's not broken.
- **File:** `game/client/test/main.test.js`
  - Test that `spawnDamageNumber` exists and creates a text element that auto-removes.

## Verification: code
