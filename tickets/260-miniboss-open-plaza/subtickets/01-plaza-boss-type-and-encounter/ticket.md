# Unique Plaza Miniboss Type, Encounter Wiring & Reward

Introduce a distinct boss enemy type unique to the open-plaza Tier-2 (`arena_trials`)
encounter, replacing the generic `miniboss` (Vault Warden) reused by the 258
stage-boss framework. The boss must have its own identity (name, stats, drops),
be wired as the Tier-2 stage boss, and on defeat clear the encounter, complete the
run with victory, and grant a distinct reward.

## Acceptance Criteria

- A new enemy type `arena_champion` exists in `ENEMY_DEFS` with a distinct
  `name` (e.g. "Plaza Sovereign"), a `description`, and stats that differ from
  the generic `miniboss` (notably higher `hp` than the miniboss's 300, plus its
  own `attackDamage`/`attackStyle`/`attackRange`/`chaseSpeed`). `enemyDefFor('arena_champion')`
  returns the def and does not throw.
- `arena_champion` has its own entries in `ENEMY_CARD_DROPS` and `ENEMY_MS_DROPS`
  (config.js), with a magic-stone drop strictly greater than the generic
  `miniboss` value (50) to make the reward distinct.
- `arena_trials` Tier-2 `encounter.bossType` is `'arena_champion'` (no longer
  `'miniboss'`); `landmark` and `addCount` are unchanged. The Tier-1 quest and
  all other quests are untouched.
- Deploying `arena_trials` Tier-2 spawns exactly one `arena_champion` boss on the
  `arena_dais` landmark, wired as `run.encounter.bossEnemyId`, with the encounter
  starting in the `dormant` phase and `addCount` adds (drawn from the pool,
  excluding both `miniboss` and `arena_champion`).
- Activating the encounter and reducing the `arena_champion` boss to 0 HP clears
  the encounter (`phase === 'cleared'`), sets `objective.bossDefeated`, completes
  the run objective, and ends the run with `status === 'victory'`. Defeating only
  the adds does not complete the run.
- A vitest test asserts the new boss type/stats, the Tier-2 `bossType` wiring,
  the dormant spawn on `arena_dais`, and the full defeat → victory + reward path.
  The existing `bossType: 'miniboss'` assertion in
  `server/test/arena_trials_tier2.test.js` is updated to `'arena_champion'`.
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- `game/server/simulation.js`: add an `arena_champion` entry to `ENEMY_DEFS`
  (after `miniboss`) following the existing shape (`name`, `description`,
  `surfacedStats`, `hp`, `chaseSpeed`, `wanderSpeed`, `attackDamage`,
  `attackWindupMs`, `attackStyle`, and optional `attackConeAngle`/`attackRange`).
  Give it distinctly higher HP (e.g. ~500) and a heavier attack profile than
  `miniboss`. No changes to the `applyVariant`/spawn seam are required — the
  existing `spawnEnemy` path handles any type in `ENEMY_DEFS`.
- `game/server/config.js`: add `arena_champion` to `ENEMY_CARD_DROPS` (reuse an
  existing reward card id such as `'dungeon_drake'`) and to `ENEMY_MS_DROPS`
  (value > 50, e.g. 70).
- `game/server/quests.js`: in `QUEST_DEFS.arena_trials.tiers[2].encounter`, change
  `bossType` from `'miniboss'` to `'arena_champion'`. Optionally add
  `arena_champion` to the `arena_trials.enemyPool` with weight 0 is NOT needed —
  the boss is spawned explicitly by the `stage_boss` objective, and
  `objectives.js` already filters the add pool by `bossType`, so the existing
  pool filtering will correctly exclude it.
- `game/server/objectives.js`: verify the `stage_boss` `spawnQuestEntities` add
  filter (`entry.type !== 'miniboss' && entry.type !== bossType`) excludes the
  new boss type from adds. No change expected, but adjust if needed so adds never
  spawn `arena_champion`.
- `game/shared/theme.json` (+ any consumers in `server/quests.js` /
  `client/questBoard.js`): if the objective summary text references a "trial
  warden", keep it generic OR update `objectives.defeatTrialWarden` /
  `defeatTrialWardenWithSupports` to reflect the unique boss name consistently on
  server and client. Keep server `formatObjectiveSummary` and client
  `questBoard.js` in sync.
- `game/server/test/arena_trials_tier2.test.js`: update the
  `getEncounterConfig(...).toMatchObject({ bossType: 'miniboss', ... })`
  assertion and the `boss.type` assertions (`toBe('miniboss')`) to
  `'arena_champion'`. Add coverage for the new boss stats and the
  defeat → victory + reward path (a dedicated test file is also acceptable).
- Boss spawn/encounter/defeat wiring lives in
  `game/server/encounters.js` + `game/server/objectives.js` and already works for
  any `bossType`; do not duplicate it — only supply the new type and config.

## Verification: code
