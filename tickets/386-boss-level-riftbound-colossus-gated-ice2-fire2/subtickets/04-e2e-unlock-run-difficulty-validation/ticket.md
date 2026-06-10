# 04 — End-to-end unlock → run → defeat test and difficulty validation

Prove the whole Rift Convergence loop with an integration test: the ice2+fire2
gate admits a qualified account, the boss-arena run plays through the dormant →
active → cleared encounter lifecycle against the Riftbound Colossus, completion
is recorded, and the level is measurably the hardest in the catalog.

## Acceptance Criteria

- A server integration test (e.g. `game/server/test/rift_convergence_e2e.test.js`) covers, in one run lifecycle:
  - An account with BOTH `frost_crossing` tier 2 and `ember_descent` tier 2 completed passes `isQuestTierUnlocked('rift_convergence', 1)`; an account missing either prereq does not.
  - Starting the run produces a `boss-arena` profile layout, a `stage_boss` objective with `totalEnemies: 5` (boss + 4 adds), and `run.encounter.phase === 'dormant'`.
  - While dormant, the boss cannot be damaged (`canDamageEnemy` from `game/server/encounters.js` is false for the boss; damaging attempts leave its HP unchanged).
  - After all 4 adds are defeated AND a player moves within `ENCOUNTER_TRIGGER_RADIUS` of the dais anchor, `tryActivateEncounter` flips the encounter to `active` + `locked`.
  - Reducing the active boss to 0 HP clears the encounter (`phase === 'cleared'`), completes the `stage_boss` objective, and records tier-1 completion on the account (via the existing `completeQuestTier(accountId, 'rift_convergence', 1)` path in `game/server/progression.js`).
- A difficulty-validation test asserts, against live defs (no hardcoded copies of other bosses' stats):
  - `ENEMY_DEFS.riftbound_colossus.hp` and `.attackDamage` are strictly greater than those of every other stage-boss def (`miniboss`, `annex_overseer`, `arena_champion`, `crucible_sovereign`, `spire_warden`, `cinder_warden`, `magma_colossus`, `permafrost_warden`, `glacial_tyrant`), and `hp <= 460` (the 180s `defeatBoss` validation ceiling documented in `game/docs/design.md`).
  - `rift_convergence`'s `encounter.addCount` is strictly greater than every other `levelKind: 'boss_level'` quest's `addCount`.
  - `rift_convergence`'s `rewardCurrency` is the highest among boss-level quests.
- `game/docs/design.md`'s Stage Bosses table gains a `riftbound_colossus` (Riftbound Colossus, rift convergence, 460 HP) row so the documented HP band stays accurate.
- `cd game && pnpm test` (full suite with coverage) passes.

## Technical Specs

- New file `game/server/test/rift_convergence_e2e.test.js`. Build it from existing patterns: `game/server/test/boss_level_spawn.test.js` (run start + spawn pipeline), `game/server/test/ember_descent_stage_boss.test.js` (boss defeat flow), `game/server/test/unlock_prereqs.test.js` (account setup with `completeQuestTier`), and the encounter helpers exported by `game/server/encounters.js` (`tryActivateEncounter`, `canDamageEnemy`, `ENCOUNTER_TRIGGER_RADIUS`).
- `game/docs/design.md` — one table row plus, if needed, a sentence noting the boss-level HP ceiling rationale.
- This sub-ticket should need NO production-code changes; if an assertion fails, fix the underlying def/quest values from sub-tickets 01–03 minimally rather than weakening the assertion.
- Depends on sub-tickets 01, 02, 03.

## Verification: code
