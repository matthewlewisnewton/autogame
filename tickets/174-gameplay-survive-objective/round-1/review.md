# Senior Review — 174-gameplay-survive-objective

## Runtime health (gate)

PASS. `metrics.json` reports `"ok": true`, `pageerrors: []`, and `capturePlanValid: true`.
`console.log`/`server.log`/`client.log` contain only benign noise (THREE.Clock
deprecation warning, a Vite `ws proxy` ECONNRESET on socket close). No `pageerror`
or `[fatal]` lines from game code. The capture screenshots show the scene, HUD,
deck and combat rendering cleanly.

Note: the capture used the deterministic **fallback** smoke plan, which selects
the default `training_caverns` (`defeat_enemies`) quest — so the captured run does
not itself exercise the new `survive` quest. The survive feature is therefore
verified here through the live code plus the (passing) unit/integration tests
rather than the screenshots. Runtime health of the build is still proven by the
clean capture.

## Acceptance criteria

### AC1 — Implements the Goal (new 'survive' objective), scoped to it

PASS.

- **Quest def** (`game/server/quests.js`): new `endless_siege` quest with
  `objectiveType:'survive'`, `totalSpawns:10`, `minibossCount:2`,
  `layoutProfile:'open-plaza'` (a valid profile in `dungeon.js`). Exposed to
  clients via `getAllQuests()` → `Object.values(QUEST_DEFS)`, so it is selectable
  on the normal quest board (no debug shortcut was added — confirmed in the diff).
- **Run state** (`progression.js createRunState`): builds a `survive` objective
  with `totalSpawns`, `minibossCount`, `spawnedEnemies`, `defeatedEnemies`, and
  mirrors `totalEnemies = totalSpawns` so the generic in-game HUD and completion
  fallback reuse it.
- **Staggered spawning** (`updateSurviveSpawns`, progression.js): tick-driven,
  no-op unless a `playing` `survive` run; releases one enemy per
  `SURVIVE_SPAWN_INTERVAL_MS` (3s); the final `minibossCount` spawns are
  minibosses, the rest cycle `grunt`/`skirmisher`; reuses `pickEnemySpawnPosition`
  + `spawnEnemy` with a per-index deterministic seed. `spawnCombatEnemies` early-
  returns for survive so the staggered spawner is the sole source. Wired into the
  game loop at `index.js:1478`.
- **Completion** (`recordEnemyDefeated` + `isRunObjectiveComplete`): both now
  branch on `survive`; the run completes when `defeatedEnemies >= totalSpawns`.
  Correctly, `syncRunObjectiveToEnemies` still skips survive, so a transiently
  empty enemy list (player out-kills the spawner) cannot prematurely complete the
  run — a real edge case that is handled well.
- **HUD** (`questBoard.js formatObjectiveSummary` + `theme.json surviveHostiles`):
  lobby quest-board case added, "Survive {count} hostiles ({minibosses} minibosses)".

The diff is tightly scoped to these files; no unrelated changes.

### AC2 — Existing tests pass; game starts and loads cleanly

PASS (with one unrelated flake noted).

- Game starts/loads cleanly — see runtime health above.
- New tests are thorough: `server.test.js` covers QUEST_DEFS metadata, survive
  run-state creation, `recordEnemyDefeated`/completion, and `updateSurviveSpawns`
  (one-at-a-time throttle, exact `totalSpawns`/`minibossCount` mix, stop-at-cap,
  phase/type gating, skip of bulk spawn). `questBoard.test.js` covers the new
  summary + board render.
- Full suite: **1651 passed, 1 failed (1652)**. The single failure is
  `account.test.js > PATCH /api/me/profile > updates email with uniqueness check`,
  caused by a filesystem race writing the shared `game/data/users.json`
  (`[auth] registration failed: ENOENT ... rename 'users.json.tmp' -> 'users.json'`)
  when suites run in parallel. It is unrelated to this ticket (account/auth code,
  untouched by the diff). Re-running `account.test.js` in isolation passes
  **10/10**. This is pre-existing test-infra flakiness, not a regression from
  this ticket, and does not block.

## Design / requirements consistency

Consistent. The change is purely additive — a new quest + an additive objective-
type branch alongside the existing `collect_items`/`defeat_enemies` branches. No
existing behavior is altered for the other objective types; the foundation in
`requirements.md` is not regressed.

## Debug scenarios

None added or changed by this ticket. The `survive` end-state is reached purely
through normal gameplay (select `endless_siege` on the quest board → start run).

## Remaining gaps

None blocking. (See `nits.md` for minor, non-blocking polish.)

VERDICT: PASS
