# Wire stage-boss encounter kills into defeatedEnemies / run summary

Implement server-side kill accounting for `stage_boss` runs so encounter adds and the stage boss increment `run.objective.defeatedEnemies`, and `buildRunSummary` exposes the correct top-level `defeatedEnemies` value shown on the Sortie Complete screen (`Hostiles purged: N`). Make the failing test from sub-ticket 01 pass and update affected regression tests.

## Acceptance Criteria

- `stage_boss` objectives created at run open include `totalEnemies: 1 + addCount` and `defeatedEnemies: 0` alongside existing `bossDefeated` / `addCount` fields.
- Killing encounter adds through `removeDeadEnemies()` increments `defeatedEnemies` by the number removed; killing the active boss increments the counter by 1 as part of the same removal path.
- `defeatedEnemies` is clamped to `totalEnemies` via `clampProgress` (reuse `clampDefeatedEnemies`).
- `recordEnemyDefeated(n)` increments `defeatedEnemies` for `stage_boss` but does **not** set `bossDefeated` or complete the objective until the real boss-defeat hook runs.
- When `tryActivateEncounter` purges dead non-boss enemies via `clearNonBossEnemies`, any dead adds still present in `gameState.enemies` are credited to `defeatedEnemies` before they are filtered out (covers batches where adds reach 0 HP without a prior `removeDeadEnemies` pass).
- `buildRunSummary('victory').defeatedEnemies` equals `1 + addCount` after defeating all adds and the boss in the sub-ticket 01 test flow.
- Existing stage-boss tier-2 tests (`training_caverns_tier2`, `spire_ascent_tier2`, `canyon_descent_tier2`, `arena_trials_tier2`) and `stage_boss_defeat.test.js` are updated: assertions that `recordEnemyDefeated` leaves the objective unchanged are narrowed to “does not complete the objective / does not set `bossDefeated`”, while permitting `defeatedEnemies` to rise.
- `pnpm test:quick` passes with no regressions in server tests.

## Technical Specs

- `game/server/objectives.js` — `stage_boss` entry:
  - Extend `createObjective` to set `totalEnemies: addCount + 1` and `defeatedEnemies: 0`.
  - Add `onEnemyDefeated(run, count)` mirroring `defeat_enemies` / `survive` (increment + clamp).
  - Implement `clampProgress` with `clampDefeatedEnemies` (replace the no-op stub).
  - Keep `onBossDefeated` responsible only for `bossDefeated = true`; do not double-count the boss if `removeDeadEnemies` already calls `recordEnemyDefeated` for the removed boss entity.
- `game/server/encounters.js` — in `clearNonBossEnemies` (or immediately before it in `tryActivateEncounter`): count non-boss enemies with `hp <= 0` still in the array and invoke `recordEnemyDefeated` for that count so activation-time purge cannot skip adds. Import `recordEnemyDefeated` from `progression.js` only if it does not create a require cycle; otherwise inline a small helper or move the credit call to `progression.js`.
- `game/server/progression.js` — only touch if needed to avoid circular imports or to harden `buildRunSummary` (e.g. `defeatedEnemies: run.objective.defeatedEnemies ?? 0`); prefer keeping the source of truth on `run.objective`.
- `game/server/test/stage_boss_defeat.test.js` (and/or `stage_boss_kill_count.test.js`) — green the sub-ticket 01 test; adjust `recordEnemyDefeated does not advance stage_boss objective progress` cases.
- `game/server/test/training_caverns_tier2.test.js`, `spire_ascent_tier2.test.js`, `canyon_descent_tier2.test.js`, `arena_trials_tier2.test.js` — same regression-test narrowing as above.
- No client changes unless inspection proves the victory overlay computes the count locally (it reads `data.defeatedEnemies` from `runComplete` today in `game/client/main.js`).

## Verification: code
