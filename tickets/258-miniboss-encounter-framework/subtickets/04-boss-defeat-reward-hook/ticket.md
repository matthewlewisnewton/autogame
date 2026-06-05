# 04 — Boss defeat reward and completion hook

Wire stage-boss death into the encounter state machine, objective completion, and existing run reward / tier-unlock plumbing through a single extensible hook.

## Acceptance Criteria

- When the enemy whose `id` matches `run.encounter.bossEnemyId` is removed via `removeDeadEnemies`, the server calls `onStageBossDefeated(gameState)` which sets `run.encounter.phase` to `cleared`, marks the `stage_boss` objective complete, and invokes a registry hook `encounterRewardHooks` (or `OBJECTIVE_DEFS.stage_boss.onBossDefeated`) so future quests can attach bonus drops without editing `removeDeadEnemies` again.
- Defeating adds after the encounter is locked does not re-trigger activation; defeating the boss while `phase === 'active'` is the only path to `cleared`.
- Boss defeat still runs existing miniboss loot paths (`spawnCurrencyDrop`, `spawnMagicStoneDrop`, `recordEnemyCardDrop`) before the encounter hook.
- `checkRunTerminalState()` emits `runComplete` when the stage-boss objective is complete (same victory path as other objectives); Tier-1 victories still call `unlockQuestTier(..., 2)` unchanged.
- `recordEnemyDefeated` does not increment generic `defeat_enemies` totals for `stage_boss` runs unless explicitly desired — boss defeat drives completion via the encounter hook only.
- Automated tests: kill boss → `encounter.phase === 'cleared'`, objective complete, `checkRunTerminalState` → victory; kill all adds but not boss → run still playing.

## Technical Specs

- **`game/server/encounters.js`** — `onStageBossDefeated(gameState, bossEnemy)`; optional `registerEncounterRewardHook(fn)` or export a small array consumed once per defeat.
- **`game/server/progression.js`** — In `removeDeadEnemies`, before filtering, if any dying enemy id matches `getEncounterBossId(run)`, call `onStageBossDefeated`.
- **`game/server/objectives.js`** — `stage_boss.onBossDefeated(run)` sets progress fields; `isComplete` reads them; omit `onEnemyDefeated` bulk counting or guard it to ignore non-boss kills.
- **`game/server/test/stage_boss_defeat.test.js`** (new) — Spawn encounter via 02 helpers, activate via 03, reduce boss HP to 0 through `removeDeadEnemies` or damage API, assert victory emit / run status.
- Reuse `checkRunTerminalState`, `grantRunRewards`, and `unlockQuestTier` — do not duplicate reward math.

## Verification: code
