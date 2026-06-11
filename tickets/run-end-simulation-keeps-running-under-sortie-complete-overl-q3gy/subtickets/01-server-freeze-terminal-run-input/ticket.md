# Server: freeze dungeon input when run reaches terminal status

## Description

When `checkRunTerminalState()` sets `run.status` to `victory` or `failed`, the server emits `runComplete`/`runFailed` and snapshots `buildRunSummary()`, but `gamePhase` stays `playing` until the squad returns to the hub. Several player-action paths still honor `isPlayingPhase` without checking `run.status`, so movement, loot pickup, and key-item use keep mutating wallet/state behind the summary overlay. Gate all interactive dungeon simulation on `run.status === 'playing'` and clear stale input when a run becomes terminal.

## Acceptance Criteria

- After `run.status` is set to `victory` or `failed`, `applyPlayerMovement` no longer changes player positions for any player
- The `move` socket handler rejects/applies no movement when `run.status !== 'playing'`
- The `lootPickup` socket handler does not credit currency, magic stones, or crystals when `run.status !== 'playing'`
- `handleUseKeyItem` rejects with `{ ok: false, reason: 'run_terminal' }` when `run.status !== 'playing'` (before cooldown/effect logic)
- `checkRunTerminalState()` clears movement input on every player (`inputActive`, `inputDx`, `inputDz`) when transitioning to terminal status
- New server test: with `run.status = 'victory'`, emitting `lootPickup` for nearby loot leaves `player.currency` and `currencyEarnedThisRun` unchanged and loot in `state.loot`
- New server test: with `run.status = 'victory'`, a `move` emit does not change `player.x`/`player.z` on the next simulation tick
- Existing `useCard` / `discardCard` terminal guards and enemy-AI terminal skip behavior remain unchanged

## Technical Specs

- **File:** `game/server/lobbies.js` — add and export `isActiveRun(state)` returning `state?.run?.status === 'playing'` (or equivalent helper used consistently)
- **File:** `game/server/simulation.js` — early-return in `applyPlayerMovement` when `!isActiveRun(state)`
- **File:** `game/server/socketHandlers/runHandlers.js` — guard `MOVE` and `LOOT_PICKUP` handlers with `isActiveRun(state)` (mirror the existing `DISCARD_CARD` pattern)
- **File:** `game/server/keyItemEffects.js` — after phase/dead/extracted guards, reject terminal runs with `reason: 'run_terminal'`
- **File:** `game/server/progression.js` — in `checkRunTerminalState()`, after `_gameState.run.status = status`, loop players and zero movement input fields
- **File:** `game/server/test/run_terminal_input.test.js` (new) — unit/integration coverage for post-victory move + lootPickup no-ops; optionally cover `failed` status the same way

## Verification: code
