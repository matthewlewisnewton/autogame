# 02 — Server: Damage reduction pipeline integration

Integrate guard block into the damage pipeline so incoming hits are reduced based on attacker angle relative to the player's facing direction.

## Acceptance Criteria

- `damagePlayer()` in `simulation.js` checks `player.blockingUntil` — if `now < blockingUntil`, damage reduction logic applies
- **Frontal arc** (~150°): damage is multiplied by `(1 - def.damageReduction)` (i.e. 30% of original when `damageReduction: 0.7`)
- **Rear** (outside 150°): full damage passes through (chip damage from behind)
- **Priority**: dodge i-frames (`invulnerableUntil`) are checked first and return `null` (complete immunity) before the block check — blocking never overrides dodge
- Block reduction applies to **all** enemy hit types that call `damagePlayer()` (melee windup, minion AoE/beam)
- After `blockingUntil` expires, damage is no longer reduced

## Technical Specs

- **server/simulation.js** (`damagePlayer`, ~line 1394): After the existing `invulnerableUntil` check (which returns `null`), add:
  ```javascript
  // Block check (only if not invulnerable — dodge takes priority)
  if (player.blockingUntil && now < player.blockingUntil) {
    const attackerPos = getAttackerPosition(options); // helper to resolve enemy/minion position
    if (attackerPos) {
      const angle = angleFromPlayerTo(attackerPos, player);
      const halfArc = (150 / 2) * (Math.PI / 180); // ~1.309 rad
      const yawDiff = Math.abs(normalizeAngle(angle - (player.blockingYaw || player.rotation || 0)));
      if (yawDiff <= halfArc) {
        // Frontal — apply damage reduction
        const def = getKeyItemDef('guard_block');
        remaining *= (1 - (def?.damageReduction || 0.7));
      }
      // else: rear — full damage (chip)
    }
  }
  ```
  The block check must come **after** the `invulnerableUntil` early-return (so dodge i-frames always win) and **before** the shield absorption logic.
- **server/simulation.js**: Helper `getAttackerPosition(options)` resolves `{x, z}` from `options.attackerEnemyId` (lookup in `_gameState.enemies`) or `options.attackerId` (minion lookup in `_gameState.minions`)
- The angle calculation uses `Math.atan2(attackerX - player.x, attackerZ - player.z)` to get direction from player to attacker, compared against `player.blockingYaw`

## Verification: code
