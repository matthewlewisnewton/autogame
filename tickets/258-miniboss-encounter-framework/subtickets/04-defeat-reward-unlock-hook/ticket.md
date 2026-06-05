# 04 — Defeat, reward, and unlock hook

When the stage boss is killed, clear the encounter, grant configured rewards, fire an optional unlock hook, and complete the run objective so victory flow (including existing Tier-1→Tier-2 unlock plumbing) can proceed.

## Acceptance Criteria

- `removeDeadEnemies` (or a dedicated encounter hook it calls) detects death of `encounter.bossEnemyId`, sets `run.encounter.status` to `cleared`, and does not treat generic mob deaths as encounter completion.
- Configured `rewardCurrencyBonus` is applied on clear (e.g. added to `run.rewardCurrency` or granted via existing `grantRunRewards` / per-player run currency — match project conventions).
- Optional `unlockOnClear: { questId, tier }` invokes `unlockQuestTier` for each in-run player with an account (idempotent); absent config leaves unlock behavior unchanged.
- Run objective completes when the stage boss is defeated (`defeat_enemies` with `totalEnemies: 1` or encounter-aware `isComplete`); `checkRunTerminalState` reaches `victory` and emits `runComplete` in tests.
- Checkpoint / suspend restore preserves `run.encounter` and `bossEnemyId` if the boss was active (extend `captureRunCheckpoint` / `restoreRunCheckpoint` as needed).
- Unit tests: kill stage boss → `cleared`, bonus reward, optional unlock mock, victory emit; killing a non-stage grunt does not clear the encounter.

## Technical Specs

- **`game/server/bossEncounter.js`** — `onStageBossDefeated(gameState, enemyId)`, `applyEncounterClearRewards(gameState)`.
- **`game/server/progression.js`** — Hook from `removeDeadEnemies` / `cleanupAfterDamage`; ensure `recordEnemyDefeated` runs for the boss; extend checkpoint capture/restore for `run.encounter`.
- **`game/server/objectives.js`** — If needed, encounter-aware `isComplete` for boss quests (prefer `defeat_enemies` + `totalEnemies: 1` to avoid a fourth objective type unless necessary).
- **`game/server/test/boss_encounter_defeat.test.js`** (new) — Spawn + start encounter, reduce boss HP, run cleanup, assert rewards, unlock hook, and `run.status === 'victory'`.
- Depends on sub-tickets **01–02**; works with **03** triggers in integration but can be tested by calling `startStageBossEncounter` directly.

## Verification: code
