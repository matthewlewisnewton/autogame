# 01-server-godmode-damage-immunity

Add a server-authoritative `debugGodmode` flag on each player and make `damagePlayer()` a no-op while it is enabled. This is the core unlimited-health behavior; the toggle wiring arrives in the next sub-ticket.

## Acceptance Criteria

- New players are created with `debugGodmode: false` in `game/server/index.js` player initialization.
- When `player.debugGodmode === true`, `damagePlayer(playerId, amount, …)` returns `null` and does not reduce `player.hp`, set `player.dead`, or schedule respawn — regardless of damage amount or attack options (melee, ranged, enemy, minion).
- When `player.debugGodmode === false` (or unset), `damagePlayer` behavior is unchanged from today.
- `debugGodmode` is not included in `buildPlayerHotSnapshot` / `buildPlayerColdSnapshot` (server-only; not leaked to clients via `stateSnapshot` or `hotStateSnapshot`).
- Automated unit tests cover godmode on/off cases (including lethal damage while godmode is on).

## Technical Specs

- **`game/server/index.js`** — add `debugGodmode: false` to the player object created in the join/connect path (near existing `debugScenario: null`).
- **`game/server/simulation.js`** — in `damagePlayer()` (around line 1854), after the `amount <= 0` guard and before the `invulnerableUntil` check, add an early return when `player.debugGodmode` is truthy.
- **`game/server/test/debug-godmode.test.js`** (new) — import `damagePlayer`, `setGameState`, `resetGameState` (or the project's existing simulation test helpers). Set up a player with full HP, toggle `debugGodmode` directly on the player record, call `damagePlayer` with lethal damage, and assert HP/dead state. Include a control case with godmode off.
- Do **not** add socket handlers or client changes in this sub-ticket.

## Verification: code
