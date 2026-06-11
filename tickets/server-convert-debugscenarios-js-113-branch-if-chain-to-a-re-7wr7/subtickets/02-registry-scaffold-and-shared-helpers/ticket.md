# Add debug scenario registry scaffold and extract shared setup helpers

## Description

`applyDebugScenario` is still a ~3000-line sequential `if (name === …)` chain with copy-pasted layout/spawn/hand setup. Introduce a `DEBUG_SCENARIO_REGISTRY` map and shared helper functions, then wire dispatch so the if-chain is no longer the primary control flow for the first batch of scenarios (those that already have named setup functions or are one-liner stubs).

## Acceptance Criteria

- `DEBUG_SCENARIO_REGISTRY` exists in `debugScenarios.js` as `{ [name]: setupFn }` where each `setupFn` receives a context `{ lobby, state, player, socket, name }` and returns either `undefined` (continue to post-setup epilogue) or an early `{ ok, … }` result
- Shared helpers are extracted for repeated patterns (quest tier-1 deploy, quest tier-2 lobby prep, card-probe playing run, telepipe-ready vitals) and used by migrated handlers
- `applyDebugScenario` dispatches via `const handler = DEBUG_SCENARIO_REGISTRY[name]` with a clear unknown-handler error; no remaining `if (name === …)` branches for migrated scenarios
- At minimum these scenarios are registry-backed: `telepipe-ready`, `fire-telepipe-ready`, `frost-telepipe-ready`, `frost-crossing-telepipe-ready`, `crucible-duel-boss`, `vault-onslaught-boss`, `rift-convergence-boss`, `scripted-wave-combat`, `escort-objective`, `frost-crossing-tier-1`, `ember-descent-tier-1` (via existing `setup*` functions), `training-caverns-tier-1`, `crystal-rescue-tier-1`, `annex-escort-tier-1`
- Post-setup epilogue (`maybeAdoptSyntheticDefeatEnemies`, `syncRunObjectiveToEnemies`, `broadcastLobbyUpdate`, state emit) still runs once for handlers that do not early-return
- Existing debug-scenario tests for migrated names still pass

## Technical Specs

- **`game/server/debugScenarios.js`**
  - Add `DEBUG_SCENARIO_REGISTRY` near existing `setup*` helpers (~150–640)
  - Refactor top-level `setupCrucibleDuelBossDebug`, `setupVaultOnslaughtBossDebug`, `setupRiftConvergenceBossDebug`, `setupEscortObjectiveDeploy`, `setupScriptedWaveCombatDeploy`, `setupQuestTier1Deploy` wrappers to registry entries
  - Extract additional shared helpers as needed: `resetPlayerForDebugScenario`, `deployQuestTier1`, `prepareTelepipeReadyLobby`, `prepareCardProbePlayingRun` (building on `resumePlayingRunForCardProbe` / `syncCardProbeHand`)
  - Replace the opening `if (name === …)` branches for migrated scenarios with registry dispatch in `applyDebugScenario` (~672+)
  - Keep `syncDebugHooksForScenario` integration from sub-ticket 01

## Verification: code
