# Senior Review: 170-gameplay-enemy-variant-volatile

## Runtime health

PASS. The captured run loaded cleanly: `metrics.json` reports `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains Vite startup/resource noise and scene initialization only; there are no `pageerror` or `[fatal]` lines from game code.

## Acceptance criteria

### Volatile-tagged enemy deals radial area damage on death within a defined radius

PASS. `game/server/enemyVariants.js` defines the `volatile` variant with explicit `radius` and `damage` tuning. Normal enemy creation still flows through `spawnEnemy()`, where combat and survive spawns pass encounter tier and seeded RNG into `applyVariant()`, so volatile enemies are reachable through ordinary dungeon play rather than only through a debug shortcut.

On death, `removeDeadEnemies()` checks the dead enemy's variant definition and calls `spawnVolatileExplosion()` before removing the corpse. That creates a one-shot `volatile_explosion` area effect with the configured radius/damage, and `updateAreaEffects()` routes it through the existing radial area-effect path for enemy damage while also applying damage to nearby minions and players.

### Effect is visible client-side

PASS. Server ticks drain `_pendingVolatileExplosions` and emit `volatileExplosion` to the owning lobby. The client listens for that event and spawns a hot-orange expanding ring effect. Volatile enemies also render with a distinct orange variant badge while generic variant enemies keep the prior magenta marker, so the threat is visually distinguishable before death.

### Covered by a server test

PASS. `game/server/test/volatile_explosion.test.js` covers volatile variant registration, player damage and radius exclusion, minion and enemy blast damage, event queueing for client VFX, and the non-volatile no-op path. The captured coverage run reports `48` test files and `1227` tests passed.

## Design and requirements fit

PASS. The implementation fits the documented multiplayer dungeon combat loop and keeps the server authoritative for enemy death, damage, and state snapshots. It does not regress the foundational requirements: the captured run shows WebSocket connection, 3D scene initialization, two-player lobby/deploy flow, movement, HUD updates, and active gameplay.

## Debug scenario review

PASS. The new `volatile-enemy` scenario is registered through the existing `?debugScenario=` flow and server-side `debugScenario` socket handler, with the same localhost/dev gating as other scenarios. Normal gameplay still reaches an equivalent state through `applyVariant()` on tiered enemy spawns followed by a real defeat. The shortcut sets up a low-HP volatile enemy and a charged weapon for deterministic QA, but the explosion itself still goes through the normal combat death, `removeDeadEnemies()`, area-effect, and client event paths.

## Code quality

PASS. The changes are scoped and use existing extension points: variant registry data, server area effects, state snapshots, renderer effect helpers, and lobby-scoped socket broadcasts. I did not find dead code, broken imports, or console/runtime errors attributable to this ticket. The only log warnings/errors observed are benign or test-environment expected noise.

## Remaining gaps

None.

VERDICT: PASS
