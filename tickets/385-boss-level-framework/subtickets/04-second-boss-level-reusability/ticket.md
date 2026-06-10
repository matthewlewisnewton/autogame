# Second boss-level quest proves reusable type

Define a second boss-level contract with a different boss type and optional support adds, demonstrating that new boss levels are authored by quest metadata alone (no new pipeline code).

## Acceptance Criteria

- `QUEST_DEFS` includes a second boss-level quest (suggested id: `vault_onslaught`, Tier 1) with `levelKind: 'boss_level'`, `layoutProfile: 'boss-arena'`, `objectiveType: 'stage_boss'`, and a different `encounter.bossType` than the reference quest (may reuse an existing stage boss such as `annex_overseer` or add a second new boss id).
- The second quest sets `encounter.addCount` to a small positive number (e.g. 2) to exercise optional minimal adds on a boss level.
- Both live boss-level quests pass a schema test asserting required fields (`levelKind`, `stage_boss`, `encounter.bossType`, `boss-arena` profile) and distinct `bossType` values.
- Deploying the second quest spawns `1 + addCount` enemies, activates the encounter on approach, and completes on boss defeat with victory rewards—without changes to `progression.js` beyond what sub-ticket 02 already landed.
- Quest-board objective summaries for both boss-level quests render via the shared `levelKind` theme templates from sub-ticket 03 (no new per-quest copy switches).
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Add `vault_onslaught` (or chosen id) tier def: `levelKind: 'boss_level'`, encounter block with distinct `bossType` and `addCount > 0`, briefing/dialogue, rewards, and `unlockRequires` (e.g. reference quest completion).
- **`game/server/simulation.js`** — Only if the chosen `bossType` is new; otherwise document reuse of an existing `ENEMY_DEFS` entry in tests.
- **`game/server/test/boss_level_reuse.test.js`** (new) — Parametrized or paired tests for both boss-level quest ids: schema, spawn counts, encounter activation, boss-defeat victory, distinct boss types.
- **`game/server/test/server.test.js`** or **`game/server/test/quests.test.js`** — Update `QUEST_DEFS` key list expectations to include both new boss-level quest ids.
- **`game/client/test/questBoard.test.js`** — Assert objective summary for the second quest uses the shared boss-level template with supports when `addCount > 0`.
- Depends on sub-tickets 01–03.

## Verification: code
