# 01-frenzied-enrage-telegraph

Add a pre-enrage telegraph for frenzied enemies: when a frenzied enemy's HP drops to ≤50%, show a 1.5-second visual warning (pulsing red glow ring on the ground) before the speed/attack boost actually applies. This gives players a reaction window to back off or prepare.

## Acceptance Criteria

- Frenzied enemies that cross the 50% HP threshold enter a 1500ms telegraph window before enrage multipliers take effect
- During the telegraph window, a pulsing red ring appears on the ground around the enemy (radius ~3 units, opacity oscillates)
- After the telegraph window expires, the enemy's chase speed and attack windup multipliers activate (existing `getFrenziedCombatMultipliers` behavior, but delayed)
- The telegraph state is tracked per-enemy on the server and included in `stateSnapshot` so all clients see it
- The existing debug scenario (`variant-frenzied` or `frenzied-enemy`) can reach and trigger the telegraph

## Technical Specs

**`game/server/enemyVariants.js`**
- Add `FRENZIED_TELEGRAPH_MS = 1500` constant
- Add `enrageTelegraphUntil` field tracking (timestamp when telegraph expires)
- Modify `getFrenziedCombatMultipliers(enemy)` to return neutral multipliers while `enrageTelegraphUntil` is in the future; return boosted multipliers only after it passes
- Add `checkFrenziedTelegraph(enemy, nowMs)` helper: when enemy HP first drops below threshold and no telegraph is active, set `enrageTelegraphUntil = nowMs + FRENZIED_TELEGRAPH_MS`
- Call `checkFrenziedTelegraph` from `updateEnemies()` in simulation.js each tick (or inline the check)

**`game/server/simulation.js`**
- In `updateEnemies()`, after damage is applied, call the telegraph check for frenzied enemies before reading combat multipliers

**`game/server/progression.js`**
- Ensure `stateSnapshot()` includes `enrageTelegraphUntil` (or a derived `enraging` boolean) per enemy so the client can render the telegraph

**`game/client/renderer.js`**
- Add `applyFrenziedTelegraphRing(enemyId, enemy)` function: creates/updates a red torus/ring mesh on the ground when `enrageTelegraphUntil` is set and not expired; pulsing opacity via `Math.sin(Date.now())` or similar
- Call from the per-enemy render loop alongside `applyEnemyVariantTint`, `applyVariantMarker`, `applyVariantEmissiveTint`
- Store ring meshes in a new `frenziedTelegraphMeshes` map (or extend existing variant mesh tracking)

## Verification: code
