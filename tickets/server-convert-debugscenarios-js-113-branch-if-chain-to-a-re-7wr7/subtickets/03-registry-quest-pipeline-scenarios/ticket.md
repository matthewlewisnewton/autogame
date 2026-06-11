# Migrate quest pipeline debug scenarios to the registry

## Description

The largest duplicated block in `applyDebugScenario` is the per-quest tier-2 harness pipeline (`*-tier-2`, `*-telepipe-ready`, `*-near-adds`, `*-boss-approach`, `*-encounter-trigger`, `*-boss-low-hp`) repeated for training caverns, arena trials, canyon descent, spire ascent, frost crossing, ember descent, and crystal rescue. Move these into registry handlers backed by shared quest-pipeline helpers.

## Acceptance Criteria

- No `if (name === '…')` branches remain for any of these scenario families:
  - `training-caverns-*` (tier-2, telepipe-ready, near-adds, boss-approach, encounter-trigger, boss-low-hp, vault-stalker)
  - `arena-trials-*` (tier-2, telepipe-ready, near-adds, boss-approach, encounter-trigger, boss-low-hp)
  - `canyon-descent-*` (tier-2, telepipe-ready, near-adds, boss-approach, encounter-trigger, boss-low-hp)
  - `spire-ascent-*` (tier-2, telepipe-ready, near-adds, boss-approach, encounter-trigger, boss-low-hp)
  - `frost-crossing-*` (tier-2, near-adds, boss-approach, encounter-trigger, boss-low-hp, frostmaw, glacial-thrower-slow, surface-transition, last-enemy)
  - `ember-descent-*` (tier-2, near-adds, cinderghast, ember-wraith-burn, last-enemy)
  - `crystal-rescue-*` (tier-2, extraction-phase)
- Shared helpers exist for the pipeline stages (tier-2 deploy, near-adds spawn, boss approach reposition/nudge timing, encounter trigger, boss low-HP) parameterized by quest id / enemy pools
- All migrated names are entries in `DEBUG_SCENARIO_REGISTRY`
- `debug-scenarios.test.js` quest-pipeline cases and validation harness scenarios for these quests still pass

## Technical Specs

- **`game/server/debugScenarios.js`**
  - Add quest-pipeline helpers, e.g. `setupQuestTier2Deploy`, `setupQuestNearAdds`, `setupQuestBossApproach`, `setupQuestEncounterTrigger`, `setupQuestBossLowHp`, `setupQuestTelepipeReady` — reuse existing helpers like `corridorStagingOutsideRoom`, `repositionNearEnemy`, `live*Adds` gate functions, and `nudgeDebugBossApproachPlayers` hook setup
  - Register handlers for every scenario name listed above
  - Delete the corresponding inline `if (name === …)` / `else if` blocks from `applyDebugScenario`
- **`game/server/index.js`**
  - No change to `DEBUG_SCENARIOS` set membership; only handler location moves

## Verification: code
