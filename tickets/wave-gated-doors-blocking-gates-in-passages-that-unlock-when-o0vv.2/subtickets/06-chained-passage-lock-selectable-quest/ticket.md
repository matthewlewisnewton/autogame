# 06 — Chained passage-lock in selectable quest

Move the two-gate room A → room B → treasure passage-lock chain from the test-only `SCRIPTED_ENCOUNTER_FIXTURE_DEF` into a registered, player-selectable quest tier so the chained pacing is reachable through normal gameplay. Retarget the `passage-lock-chain` debug scenario to shortcut that real quest flow instead of injecting the fixture.

## Acceptance Criteria

- A quest in `QUEST_DEFS` (prefer `training_caverns` tier 1 — Initiate Vault) declares **two** `passageLocks` bound to different `afterWave` targets: room 0 wave 0 opens the first passage; room 1 wave 0 opens the second passage to a third room.
- The quest tier includes a third scripted room (treasure/end) reachable only after both gates unlock; layout generation with a documented seed yields three connected rooms along the chain.
- Deploying that quest tier through normal selection (not fixture registration) initializes both locks `locked: true` and unlocks them sequentially as each bound wave clears.
- `passage-lock-chain` debug scenario deploys the **same** registered quest tier and seed (no `ensurePassageLockChainFixtureQuest` / `SCRIPTED_ENCOUNTER_FIXTURE_DEF` override); comment documents that normal play reaches the same end-state via quest board selection.
- `cd game && pnpm test:quick` passes, including an updated `game/server/test/passage_lock_chain.test.js` that exercises the registered quest from `QUEST_DEFS` (not a runtime fixture injection) through the full A → B → treasure progression.

## Technical Specs

- **Edit:** `game/server/quests.js` — extend `training_caverns.tiers[1].scriptedEncounters` with a third `rooms[]` entry (room index 2, empty or light final wave) and a second `passageLocks` entry `{ afterWave: { roomIndex: 1, waveIndex: 0 }, fromRoomIndex: 1 }`. Add any brief dialogue beacon for the second unlock if it pairs with existing Annex Liaison lines. Update tier description/briefing only if needed to mention the deeper vault wing.
- **Edit:** `game/server/debugScenarios.js` — rewrite `passage-lock-chain` handler to call `setupTrainingCavernsTier1Deploy` (or equivalent) with the chained-layout seed instead of `ensurePassageLockChainFixtureQuest` + fixture quest id. Remove or narrow fixture-only registration for this scenario.
- **Edit:** `game/server/test/passage_lock_chain.test.js` — replace `registerPassageLockChainFixture` / `SCRIPTED_ENCOUNTER_FIXTURE_DEF` usage with `training_caverns` tier 1 from `QUEST_DEFS` and a fixed seed known to produce room 0 → 1 → 2 passages; keep collider and sequential-unlock assertions.
- **Reference (unchanged):** `SCRIPTED_ENCOUNTER_FIXTURE_DEF` may remain for other unit tests but must not be the only source of the two-gate chain.

## Verification: code
