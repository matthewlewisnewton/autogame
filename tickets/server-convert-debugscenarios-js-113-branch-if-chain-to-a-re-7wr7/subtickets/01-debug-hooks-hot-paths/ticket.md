# Gate debug scenario side effects behind `player.debugHooks`

## Description

Debug scenario names currently leak into production hot paths: `handleUseCard` checks `CARD_PROBE_DEBUG_SCENARIOS.has(player.debugScenario)`, `regenMagicStones` branches on `summon-low-mana` and telepipe grace fields every tick, and related deploy/telepipe paths in `progression.js` and `cardEffects.js` compare scenario strings. Introduce a nullable `player.debugHooks` object that is set once when a debug scenario is applied and read via a single field check in gameplay code.

## Acceptance Criteria

- `applyDebugScenario` calls a `syncDebugHooksForScenario(player, name)` helper that sets `player.debugHooks` to a scenario-specific object or `null` when clearing
- `regenMagicStones` in `simulation.js` has no `player.debugScenario` string comparisons; it only reads `player.debugHooks` (nullable guard)
- `handleUseCard` and other debug branches in `cardEffects.js` have no `CARD_PROBE_DEBUG_SCENARIOS` / `player.debugScenario` checks; they read `player.debugHooks` instead (including telepipe MS grace pinning and forced status rolls)
- `nudgeDebugBossApproachPlayers` no longer uses `BOSS_APPROACH_NUDGE_SCENARIOS.has(player.debugScenario)`; it checks a hook flag on `player.debugHooks`
- Telepipe deploy hand / MS grace setup in `progression.js` reads hook flags instead of comparing `player.debugScenario` strings
- `player.debugScenario` remains set for logging/client sync; behavior is unchanged
- `pnpm test` passes (especially `debug-scenarios.test.js`, `server.test.js` `regenMagicStones`, card probe tests)

## Technical Specs

- **`game/server/debugScenarios.js`**
  - Add `syncDebugHooksForScenario(player, name)` mapping scenario names to hook objects, e.g. `{ cardProbe: true }`, `{ pinMagicStonesZero: true }`, `{ msRegenGrace: { until, pinnedMagicStones } }`, `{ bossApproachNudge: true }`, `{ forceStatusRoll: 'slow' }`, `{ telepipeHand: 'fire' | 'frost-crossing' }`, `{ extendedFreezeDurationMs: 10000 }`
  - Call it in the shared reset block of `applyDebugScenario` immediately after `player.debugScenario = name`
  - Clear `player.debugHooks = null` when scenarios are cleared elsewhere
- **`game/server/simulation.js`**
  - Refactor `regenMagicStones()` (~3830) to branch only on `player.debugHooks` fields
- **`game/server/cardEffects.js`**
  - Remove `CARD_PROBE_DEBUG_SCENARIOS` set; use `player.debugHooks?.cardProbe`
  - Replace telepipe MS grace, frost-nova duration, and `debugForceStatusRoll` checks with hook fields
- **`game/server/progression.js`**
  - Replace `player.debugScenario === '…-telepipe-ready'` branches in `applyTelepipeReadyHand` and `checkAllReady` deploy with `player.debugHooks` flags
- **`game/server/debugScenarios.js`** (`nudgeDebugBossApproachPlayers`)
  - Replace `BOSS_APPROACH_NUDGE_SCENARIOS` set lookup with `player.debugHooks?.bossApproachNudge`

## Verification: code
