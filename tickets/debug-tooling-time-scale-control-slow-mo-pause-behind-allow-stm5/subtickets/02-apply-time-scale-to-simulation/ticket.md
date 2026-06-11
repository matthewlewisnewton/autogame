# Server: apply debug TIME_SCALE to enemy/projectile/minion/windup simulation

Consume the per-lobby `debugTimeScale` (added in sub-ticket 01) so that
enemy AI, enemy projectiles, minions, and combat windups advance at the scaled
rate, while **player movement stays at full speed**. `scale = 0.25` makes
enemies move/attack 4x slower; `scale = 0` freezes them; `scale = 1` is normal.

## Acceptance Criteria
- A single helper (e.g. `debugScaledDt()` or reading
  `_gameState.debugTimeScale ?? 1`) is used to scale the per-tick `dt`
  (`1 / TICK_RATE`) in the enemy-side simulation, so the scale flows through
  consistently rather than being hand-multiplied in scattered ways.
- `updateEnemies()`, `updateEnemyProjectiles()`, and `updateMinions()` advance
  using the **scaled** `dt` (movement, chase, projectile travel, wander).
- Combat windups / attack cadence are scaled: enemy attack windup-to-strike
  timing and re-attack cooldowns advance more slowly under a sub-1 scale and do
  not advance at all when `scale = 0` (enemies freeze mid-windup instead of
  still landing hits).
- Status-timer progression driven by the sim (e.g. burn ticks via
  `updateBurning()`, slow expiry) reflects the scale, so slow/burn interactions
  can be observed in slow-motion.
- `applyPlayerMovement()` and player input handling are **NOT** scaled — at
  `scale = 0.25` or `scale = 0`, the player still moves/turns at normal speed.
- With `debugTimeScale` at its default of `1`, simulation behaviour is
  byte-for-byte unchanged from before this sub-ticket (no regression to normal
  play).

## Technical Specs
- `game/server/simulation.js`: the update functions compute
  `const dt = 1 / TICK_RATE;` locally (see `updateEnemies` ~2980,
  `updateEnemyProjectiles` ~3259, `updateMinions` ~3301, and the AI helpers
  taking a `dt` arg such as `updateWyrmMinionAI`, `updateFieldMedicEnemy`).
  Introduce a scale read from the active `_gameState` (the module already holds
  a `_gameState` lobby context via `setGameState`) and multiply these `dt`
  values by `Math.max(0, Math.min(1, _gameState.debugTimeScale ?? 1))`.
  Add a small exported/internal helper so the same clamp is reused.
- Windup / cooldown timing: for time-based attack windups and cooldowns in
  `updateEnemies` (and `processPendingCardWindups` if it governs enemy strikes),
  advance the relevant accumulators by the scaled `dt` (or scale the elapsed
  time used to decide "is the windup done"). When the scale is `0`, these
  accumulators must not advance.
- `updateBurning()` (`game/server/simulation.js` ~1468) and any slow-expiry
  logic: gate/scale tick progression by the same factor so DoT/slow timers
  slow down with the world. (If burn uses wall-clock `Date.now()` intervals,
  scale the *effective* elapsed time rather than removing the wall-clock guard.)
- Do NOT touch `applyPlayerMovement` (`game/server/simulation.js` ~600) or the
  player input pipeline in `game/server/index.js`'s `runGameLoopTick`.
- Keep the default-`1` fast path allocation-free / branch-cheap so the normal
  game loop is unaffected.

## Verification: code
