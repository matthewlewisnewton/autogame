# Frost Crossing encounter debug scenarios

Add and fix Frost Crossing tier 1 debug scenarios so validation and QA can reach an **active, locked** Permafrost Warden encounter—the state that drives `#boss-encounter-hud`—via both the proximity-trigger path and a deterministic shortcut. Today `frost-crossing-last-enemy` manually activates the boss but appears to skip the engaged HUD path; canyon/spire already ship paired `*-boss-approach` + `*-encounter-trigger` + `*-boss-low-hp` scenarios that this quest lacks.

## Acceptance Criteria

- `game/server/debugScenarios.js` registers **`frost-crossing-encounter-trigger`**, implemented with `setupQuestEncounterTrigger` (mirror `canyon-descent-encounter-trigger` / `spire-ascent-encounter-trigger`): scripted non-boss hostiles cleared, player within `ENCOUNTER_TRIGGER_RADIUS` of the `ice_cairn` anchor, `run.encounter.phase === 'active'`, `run.encounter.locked === true`, live `permafrost_warden` still present.
- **`frost-crossing-boss-low-hp`** added via `setupQuestBossLowHp` (`bossType: 'permafrost_warden'`, `activateEncounterIfDormant: true`, `pinHpTwice: true`) for quick boss defeat after HUD capture.
- **`frost-crossing-last-enemy`** refactored to delegate to the boss-low-hp path (or equivalent) so it leaves the encounter **active + locked** with a 1-HP warden beside the player—no dormant-only or cleared-only shortcut that bypasses the HUD-driving phase.
- Existing **`frost-crossing-boss-approach`** remains dormant after scripted clears; `BOSS_APPROACH_NUDGE_DEBUG_SCENARIOS` still includes it; `nudgeDebugBossApproachPlayers` can call `tryActivateEncounter` once adds are cleared and the nudged player enters the trigger radius.
- New scenarios are allowlisted in `game/server/index.js`.
- `game/server/test/debug-scenarios.test.js` covers `frost-crossing-encounter-trigger` (active/locked encounter, live warden) and updated `frost-crossing-last-enemy` / `frost-crossing-boss-low-hp` expectations.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/debugScenarios.js`**
  - Add `frost-crossing-encounter-trigger` handler calling `setupQuestEncounterTrigger` with `questId: 'frost_crossing'`, `tier: 1`, `bossType: 'permafrost_warden'`, `bossNotFoundReason: 'Permafrost Warden boss not found'`.
  - Add `frost-crossing-boss-low-hp` via `setupQuestBossLowHp` on the same quest/tier/boss.
  - Refactor `setupFrostCrossingLastEnemyDebug` to reuse boss-low-hp setup (or call shared helper) instead of a one-off `activateEncounter` block that may diverge from the canonical engaged state.
  - Reuse existing helpers: `clearFrostCrossingScriptedHostiles`, `isFrostCrossingTier1StageBossRun`, `repositionNearEnemy`, `emitQuestDebugState`.
- **`game/server/index.js`** — add both scenario names to the debug allowlist.
- **`game/server/test/debug-scenarios.test.js`** — extend the `frost-crossing harness shortcuts` describe block with encounter-trigger and boss-low-hp cases; assert encounter phase/lock and boss type after each scenario emit.
- **Scope:** server debug scenarios and tests only; no harness or client changes in this sub-ticket.

## Verification: code
