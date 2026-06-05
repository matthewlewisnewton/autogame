# Scale enemy attack damage with party size

Make enemy strikes against players hit harder as party size grows above 4, up to the 16
cap. 1–4 players take baseline damage. Damage is scaled at the moment of the strike using
the live player count, so it tracks mid-run JOIN/LEAVE up and down and never bakes a stale
multiplier into the enemy.

## Acceptance Criteria

- For 1–4 active players, the damage an enemy deals to a player equals its base
  `attackDamage` (no behaviour change vs. today).
- For 5..16 players, the damage dealt is the base `attackDamage` scaled by
  `difficultyScaleFactor(count, DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER)`, read live at strike
  resolution from `runPlayerCount(_gameState)`.
- The enemy's stored `attackDamage` stat is NOT mutated — the scaling is applied to the
  amount passed into `damagePlayer` so the multiplier always reflects the current count
  (a mid-run JOIN raises subsequent hits, a LEAVE lowers them).
- A dedicated automated test exercises a mid-run JOIN and a mid-run LEAVE and asserts the
  damage applied to a player rises then falls with the live count (and that 1–4 players take
  baseline damage). Use the existing enemy strike path (windup → strike) or assert on the
  scaled amount passed to `damagePlayer`.

## Technical Specs

- `game/server/simulation.js`: at the enemy strike resolution where
  `damagePlayer(enemy.windupTargetId, enemy.attackDamage, …)` is called (in the windup-complete
  branch around line 1908), multiply the damage by
  `difficultyScaleFactor(runPlayerCount(_gameState), DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER)`
  (import from `./config`). Scale only player-directed enemy damage; leave minion damage and
  player/minion-dealt damage unchanged. Do not alter `ENEMY_DEFS` base stats.
- `game/server/test/enemy_damage_scaling.test.js` (new): construct an enemy poised to strike
  a player (or call the strike path directly) across player counts and a mid-run join/leave;
  assert on resulting player HP loss / the scaled damage. Model setup on existing simulation
  combat tests in `game/server/test/`.

## Verification: code
