# Reference boss-level quest (Crucible Sovereign)

Add the first live boss-level quest—a dedicated single-boss contract on the `boss-arena` profile—plus lobby copy, a debug shortcut, and end-to-end tests proving deploy → encounter activation → boss defeat → victory rewards.

## Acceptance Criteria

- `QUEST_DEFS` includes a new boss-level quest (suggested id: `crucible_duel`, Tier 1 only) with `levelKind: 'boss_level'`, `layoutProfile: 'boss-arena'`, `objectiveType: 'stage_boss'`, and `encounter: { bossType: '<new_boss_id>', landmark: 'arena_dais', addCount: 0 }` (or `addCount: 2` if minimal supports are desired).
- A distinct stage-boss enemy type is registered in `ENEMY_DEFS` (suggested id: `crucible_sovereign`) with display name, stats in the stage-boss HP band (~300–420 per `design.md`), and a signature drop; wired as the reference quest's `bossType`.
- The quest appears in `listQuests()` / quest-board payloads with boss-level objective copy (not a generic `defeat_enemies` string). Server `formatObjectiveSummary` and client `formatObjectiveSummary` in `questBoard.js` use reusable boss-level theme strings keyed off `levelKind` (e.g. `THEME.objectives.defeatBossLevel` with `{bossName}`), not a one-off `questId ===` branch.
- `unlockRequires` gates the quest appropriately (e.g. completing `arena_trials` Tier 2) using the ticket-384 array/single-object form.
- Debug scenario (e.g. `crucible-duel-boss`) behind `ALLOW_DEBUG_SCENARIOS=1` deploys the boss-level run with `run.encounter.bossEnemyId` set; registered in `index.js` allowlist.
- Server test file (e.g. `game/server/test/crucible_duel.test.js`) covers catalog fields, deploy spawn shape, encounter activation, boss defeat victory, and unlock gating. Client `questBoard.test.js` covers the new objective summary string.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Add `crucible_duel` (or chosen id) tier def with `levelKind`, encounter metadata, `client` briefing/dialogue, `rewardCurrency`, `signatureCardId` / `rewardCards`, and `unlockRequires`. Extend `formatObjectiveSummary` `stage_boss` branch with a `levelKind === 'boss_level'` path using theme templates.
- **`game/server/simulation.js`** + **`game/shared/constants.json`** (if enemy registry is mirrored) — New `crucible_sovereign` `ENEMY_DEFS` entry.
- **`game/server/debugScenarios.js`** + **`game/server/index.js`** — Debug deploy shortcut for harness playthrough.
- **`game/shared/theme.json`** — Add `objectives.defeatBossLevel` and `objectives.defeatBossLevelWithSupports` (with `{bossName}` / `{addCount}` placeholders).
- **`game/client/questBoard.js`** — Mirror server boss-level objective summary logic for lobby cards.
- **`game/server/test/crucible_duel.test.js`** (new) — End-to-end boss-level flow for the reference quest.
- **`game/client/test/questBoard.test.js`** — Assert formatted objective for the new quest.
- Depends on sub-tickets 01–02.

## Verification: code
