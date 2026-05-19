# Minion Attack Effect

When a minion attacks an enemy (minion deals damage during the server tick), produce a visible effect so the player can see the minion hitting.

## Acceptance Criteria
- A `spawnHitSpark(position)` helper function exists in `game/client/main.js`.
- When minion damage is detected (enemy HP drops between state updates but no `cardUsed` event was the cause), a small spark/burst effect is spawned at the enemy's position.
- The spark is a simple Three.js mesh (e.g., a small expanding sphere or cone burst) that fades out within 300-500ms.
- The minion mesh also briefly flashes or pulses when it deals damage.

## Technical Specs
- **File:** `game/client/main.js`
  - Add `spawnHitSpark(position)` — creates a small sphere or icosahedron at the given position, briefly scales up and fades out, auto-removes from scene and `activeEffects` after ~400ms.
  - In the `animate` loop, when detecting minion damage (HP drop not from `cardUsed`), call `spawnHitSpark` at the enemy's position.
  - Also briefly flash the minion mesh that is nearest to the damaged enemy (to show which minion attacked).
- **File:** `game/client/test/main.test.js`
  - Test that `spawnHitSpark` exists and adds an effect to `activeEffects` that auto-cleans.

## Verification: code
