# Frost Crossing boss HUD end-to-end regression

Prove the Permafrost Warden encounter activation path produces a non-null client `bossEncounter` model and a visible `#boss-encounter-hud` during an active fight—the gap reported in QA where harness `bossEncounter` stayed null through the entire `frost-crossing-last-enemy` boss fight. Cover both the natural `tryActivateEncounter` landmark trigger and the debug encounter-trigger shortcut.

## Acceptance Criteria

- **Natural trigger:** `game/server/test/frost_crossing_stage_boss.test.js` (or `encounter_trigger_lock.test.js`) includes a case that clears scripted hostiles, moves the player within `ENCOUNTER_TRIGGER_RADIUS` of the `ice_cairn` spawn anchor, calls `tryActivateEncounter`, and asserts `phase === 'active'`, `locked === true`, and the warden remains alive—matching ticket-258 landmark rules.
- **Client HUD model:** `game/client/test/boss-encounter-hud-wiring.test.js` (or a new focused test) asserts that with `run.questId === 'frost_crossing'`, `encounter: { phase: 'active', locked: true, bossEnemyId }`, and a live `permafrost_warden` enemy, `__updateBossEncounterHud()` returns a model with `name === 'Permafrost Warden'`, `hpPct > 0`, and `#boss-encounter-hud` is not `.hidden`.
- **Socket integration:** `game/server/test/debug-scenarios.test.js` (or `integration.test.js`) adds a case that deploys `frost-crossing-tier-1`, emits `frost-crossing-encounter-trigger`, and asserts server state `run.encounter.phase === 'active'` with a live `permafrost_warden` at 1 HP when using the boss-low-hp scenario—documenting the engaged state the harness must observe before boss defeat.
- If investigation shows `bossEncounter` stays null despite active server encounter (e.g. missing `run.encounter` or boss row in client `gameState.enemies` after `STATE_UPDATE`), apply the minimal fix in `game/client/socketHandlers/stateHandlers.js`, `game/client/main.js`, or `game/client/boss-encounter-hud.js` and cover it with the test above.
- Depends on passed sub-tickets **01** and **02**.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/test/frost_crossing_stage_boss.test.js`** — add explicit `tryActivateEncounter` proximity test at `ice_cairn` after scripted wave clears (may extend existing `activates the encounter after scripted clears` case to use real `tryActivateEncounter` instead of only `activateEncounterForTest` helper).
- **`game/server/test/debug-scenarios.test.js`** — integration-style test for `frost-crossing-encounter-trigger` server engaged state; optional follow-on `frost-crossing-boss-low-hp` asserting warden at 1 HP while encounter remains active until damage.
- **`game/client/test/boss-encounter-hud-wiring.test.js`** — assert HUD visibility + `__getBossEncounterModel()` non-null for active locked `frost_crossing` / `permafrost_warden` state (extend existing per-level name cases if sufficient).
- **`game/client/boss-encounter-hud.js`** / **`game/client/main.js`** / **`game/client/socketHandlers/stateHandlers.js`** — only if a client sync bug is found; keep diff minimal.
- **Optional:** run `pnpm validate:ice` once to refresh `game/validation/ice/` artifacts showing `bossEncounterUi.hudVisible === true` and boss name **Permafrost Warden** in `probes.json` / `05-boss-active.png` (or equivalent step name from sub-ticket 02). Do not change harness files here if sub-ticket 02 already landed.

## Verification: code
