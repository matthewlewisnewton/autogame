# Failing server test for stage-boss hostiles-purged count

Add a server vitest that reproduces ticket 282 through the real `removeDeadEnemies` / `buildRunSummary` path (not a debug shortcut). The `stage_boss` objective currently has no `defeatedEnemies` field and no `onEnemyDefeated` hook, so killing encounter adds and the boss leaves `buildRunSummary().defeatedEnemies` undefined/0 even when `bossDefeated` is true. This sub-ticket only adds the red test that documents the bug and expected totals.

## Acceptance Criteria

- A new or extended vitest deploys a `stage_boss` fixture quest with `addCount >= 2` (reuse the `stage_boss_defeat_fixture` pattern from `stage_boss_defeat.test.js` or equivalent).
- The test kills all adds via `enemy.hp = 0` + `removeDeadEnemies()` while the encounter is still dormant, then activates the encounter, then kills the boss via the same removal path, then calls `cleanupAfterDamage()` / `checkRunTerminalState()` so the run reaches `victory`.
- After the full flow, the test asserts `state.run.objective.defeatedEnemies === 1 + addCount` (boss plus every add).
- The test asserts `buildRunSummary('victory').defeatedEnemies === 1 + addCount`.
- The test asserts `state.run.objective.bossDefeated === true` and `isRunObjectiveComplete(state.run.objective) === true` (victory path still works; only the kill counter is wrong today).
- Running `pnpm test:quick` (or the single new test file) shows the new test **failing** on current `main` code — do not implement the fix in this sub-ticket.
- A brief comment in the test file notes that this is a real combat-path bug (not debug-only): `recordEnemyDefeated` is a no-op for `stage_boss` because `objectives.js` lacks `onEnemyDefeated`.

## Technical Specs

- Primary file: `game/server/test/stage_boss_defeat.test.js` (extend the existing fixture suite) **or** new `game/server/test/stage_boss_kill_count.test.js` if separation keeps the red test obvious.
- Import helpers from the existing stage-boss fixture: `deployStageBossRun`, `activateEncounterForTest`, `bossEnemy`, `removeDeadEnemies`, `cleanupAfterDamage`, `checkRunTerminalState`, `buildRunSummary`, `isRunObjectiveComplete`.
- Kill adds individually or in batch before activation; do **not** call `recordEnemyDefeated` directly — only the `removeDeadEnemies` path should drive the counter.
- No changes to `game/server/objectives.js`, `game/server/encounters.js`, `game/server/progression.js`, or client code in this sub-ticket.

## Verification: code
