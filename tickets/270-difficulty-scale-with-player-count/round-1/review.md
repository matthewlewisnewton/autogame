## Runtime health

The captured run is healthy. `metrics.json` reports `"ok": true`, no harness failure, and an empty `pageerrors` array. `console.log` contains only Vite connection messages and two benign 409 resource responses from the auth/lobby flow; there are no `pageerror` or `[fatal]` entries from game code.

The fallback smoke capture reached the lobby, entered gameplay with two players, rendered the scene and card HUD, moved the player, and exercised the dodge cooldown probe. `coverage.log` reports 30 passing test files and 921 passing tests.

## Acceptance criteria

### 5..16 players add small increments while 1..4 stay baseline

Pass. `game/server/config.js` centralizes the tuning constants and pure helpers: 1-4 players produce factor `1.0`, counts 5-16 add one marginal increment per player above four, and counts above 16 clamp to the 16-player cap. The increments are small and separately tunable for spawn rate, enemy damage, and miniboss HP.

### Spawn rate tracks live count up and down

Pass. `game/server/objectives.js` applies the spawn-rate factor to the survive objective's staggered spawn interval on every tick instead of snapshotting it, so mid-run joins shorten the interval and leaves lengthen it. `game/server/test/spawn_rate_scaling.test.js` separately verifies baseline counts, scaled counts through the 16-player cap, and join/leave churn.

### Enemy damage tracks live count up and down

Pass. `game/server/simulation.js` applies the enemy-damage factor at strike resolution for player-directed enemy attacks, leaving stored enemy `attackDamage` unchanged and allowing later joins/leaves to affect subsequent hits. `game/server/test/enemy_damage_scaling.test.js` verifies baseline counts, scaled counts, live join/leave changes, and no mutation of the stored enemy stat.

### Miniboss HP scales at spawn and is not retroactive

Pass. `game/server/progression.js` scales miniboss `hp` and `maxHp` inside `spawnEnemy()` only when the enemy is created, using the current party count. Existing minibosses are not revisited when the party later changes. `game/server/test/miniboss_hp_scaling.test.js` covers baseline and scaled spawns, non-miniboss enemies remaining unchanged, and join/leave changes not retroactively altering existing minibosses.

### Count helper stays correct under churn

Pass. `game/server/config.js` exposes `runPlayerCount()` as the single helper all three systems read, clamps at `MAX_PLAYERS`, and the config test suite verifies count increases and decreases as players are added and removed. This is consistent with the lobby leave path deleting players from `gameState.players` and the drop-in path adding them.

## Design and regression check

The implementation is server-side only and does not alter the documented lobby/dungeon/deck loop, rendering, movement synchronization, or socket architecture in `CONTEXT.md`, `game/docs/design.md`, and `game/docs/requirements.md`. It does not add or change any debug scenario URL shortcut, so the debug-scenario review criteria are not applicable.

## Remaining gaps

No blocking gaps found.

VERDICT: PASS
