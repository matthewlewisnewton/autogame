# 04 — Tier-1 scripted arcs integration validation

Cross-quest validation that the three reworked tier-1 quests deliver observably different arcs, contain zero random bulk spawns, and remain solo-clearable — satisfying the parent ticket acceptance criteria.

## Acceptance Criteria

- For `training_caverns`, `crystal_rescue`, and `frost_crossing` tier 1: `skipBulkCombatSpawn(quest)` is true and deploy produces enemy counts matching **only** authored `scriptedEncounters` (+ crystal ambush when applicable), never weighted `enemyPool` rolls.
- The three quests expose **distinct** objective summaries, briefing NPCs, reward cards, and dialogue beacon id sets (no duplicate arc fingerprints).
- Each quest has at least one passage gate (training + frost) or extraction phase (crystal) verifiable in tests.
- Solo-clearable enemy totals: combined authored + ambush hostiles per quest ≤12, with no single deploy wave >3 enemies.
- `cd game && pnpm test:quick` passes, including new/updated `game/server/test/tier1_scripted_arcs.test.js` covering all three quests in one file.
- Optional: `game/server/debugScenarios.js` deploy shortcuts (`training-tutorial`, `crystal-ambush`, `frost-ice-set`) for manual harness QA.

## Technical Specs

- **`game/server/test/tier1_scripted_arcs.test.js`** — New file: for each quest, generate canonical layout seed, deploy, assert initial enemy count, assert `getScriptedEncounterConfig` / passage locks / extraction fields, and spot-check distinct metadata vs the other two quests.
- **`game/server/test/tier1_quest_identity.test.js`** — Refresh expectations from sub-tickets 01–03 (beacon counts, arc-specific fields).
- **`game/server/test/quests-spawn-pools.test.js`** — Confirm tier-1 scripted quests still declare `enemyPool` for tier-2 compatibility but tier-1 deploy never bulk-spawns from it.
- **`game/server/debugScenarios.js`** — Optional named scenarios for each reworked arc (content-only shortcuts, no engine changes).
- **No gameplay changes** unless tests reveal a regression from 01–03; fix only test gaps or debug shortcuts here.

## Verification: code
