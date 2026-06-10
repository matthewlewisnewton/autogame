# 05 — Fix frost-crossing-frostmaw debug scenario

The `frost-crossing-frostmaw` harness shortcut must land in the same state as normal play after clearing the stone dock and the first ice-band thrower wave: `Rimecast the Slow` alive on the ice sheet with no remaining dock or ice wave-0 throwers.

## Acceptance Criteria

- Running the `frost-crossing-frostmaw` debug scenario returns `{ ok: true, scenario: 'frost-crossing-frostmaw' }`.
- After the scenario applies, `state.enemies` contains exactly one enemy with `displayName === 'Rimecast the Slow'` (alive, `hp > 0`).
- No enemies remain from dock wave 0 (`scriptedWave.roomKey === 'room:0'`) or ice wave 0 (`scriptedWave.roomKey === 'band:ice' && scriptedWave.waveIndex === 0`).
- All passage locks are unlocked (`locked === false`).
- Player is repositioned near Rimecast (within combat range) on the ice band.
- New test in `game/server/test/debug_scenarios_tier1.test.js` asserts the above via socket `debugScenario` emit (same pattern as `undead_commander.test.js`).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/debugScenarios.js`** — In the `frost-crossing-frostmaw` branch (~line 1288):
  1. After `setupFrostCrossingTier1Deploy`, clear only dock wave 0 enemies (`roomKey === 'room:0'`, `waveIndex === 0`), then `removeDeadEnemies()`.
  2. Unlock passage locks and `rebuildWallColliders()`.
  3. Teleport the player into the ice room (`room.band === 'ice'`), then call `updateScriptedEncounters()` so ice wave 0 throwers spawn.
  4. Kill ice wave 0 enemies (`roomKey === 'band:ice'`, `waveIndex === 0`), `removeDeadEnemies()`, then call `updateScriptedEncounters()` again so wave 1 (Rimecast + skirmisher) spawns.
  5. Find Rimecast, freeze wander, and `repositionNearEnemy(player, rimecast)`; keep the existing weapon-hand fallback.
  - **Do not** pre-kill `band:ice` wave 0 before step 3 — that is the current bug (cleanup runs before ice wave 0 exists).
- **`game/server/test/debug_scenarios_tier1.test.js`** — New file with a socket integration test for `frost-crossing-frostmaw` that reads lobby state after `debugScenarioResult` and asserts Rimecast presence and absence of prior-wave enemies. Mirror helpers from `undead_commander.test.js` (`startTestServer`, `connectClient`, `waitForEvent`).

## Verification: code
