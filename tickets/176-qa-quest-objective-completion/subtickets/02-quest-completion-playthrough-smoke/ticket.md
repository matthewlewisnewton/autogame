# Quest-completion playthrough smoke script (Playwright)

Add a headless-browser smoke script that plays a quest from acceptance to
objective completion and verifies the objective flips to complete and the
reward / quest-complete state fires — the QA playthrough deliverable for this
ticket. It reuses the deterministic hooks added in sub-ticket 01.

## Acceptance Criteria

- A new Playwright script `game/client/scripts/test-quest-completion.mjs` exists,
  modelled on the sibling smoke scripts (`test-keyitems-capture.mjs`,
  `test-creature-burndown.mjs`, `test-deck-loadout.mjs`).
- The script launches its OWN isolated server + client on high, non-default ports
  so live runs are untouched: server `PORT=32xx`, vite `--port 52xx --strictPort`
  with `HARNESS_GAME_PORT` matching, server env `ALLOW_DEBUG_SCENARIOS=1` and
  `PERSISTENCE_BACKEND=memory` (mirror how `test-deck-loadout.mjs` spawns its
  server/client). It tears down every process it starts on success AND failure.
- The script drives the real flow: `POST /api/register`, inject the token into
  `localStorage('autogame_token')`, create a lobby, ready up, and wait for game
  phase `playing` (reuse the patterns already in the sibling scripts).
- With a `defeat_enemies` quest selected (the default `training_caverns`), the
  script invokes `window.__requestDebugScenarioForTest('quest-objective-near-complete')`,
  asserts the scenario applied (`ok: true`), then reads
  `window.__AUTOGAME_HARNESS_STATE__()` and confirms the objective is NOT yet
  complete (`runObjectiveComplete === false`, one enemy present).
- The script then defeats the remaining enemy through real input/combat (attack
  the spawned grunt) and polls `__AUTOGAME_HARNESS_STATE__()` until it observes
  the objective flip to complete: `runObjectiveComplete === true` and
  `objective.defeatedEnemies >= objective.totalEnemies`.
- The script confirms the quest-complete / reward state fired: `runStatus` reaches
  `victory` AND `lastRunSummary` is populated with `status === 'victory'`,
  `objective` complete, and `rewards.currency > 0`. It fails with a clear,
  state-dumping error message if any assertion is unmet (follow the sibling
  scripts' `.catch` diagnostics style).
- The script saves evidence: at least one screenshot and a JSON state snapshot
  (the final `__AUTOGAME_HARNESS_STATE__()` plus `lastRunSummary`) under
  `game/docs/walkthroughs/quest-completion/`, and prints the saved paths.
- The script exits non-zero on any failure and `0` only when the full
  accept → satisfy objective → complete → reward path is verified.
- Existing server + client test suites still pass; the game starts and loads
  cleanly via the script's own launch.

## Technical Specs

- New file: `game/client/scripts/test-quest-completion.mjs`. Use `playwright`
  `chromium` headless. Copy the server/client spawn + readiness-wait + login
  helpers from `game/client/scripts/test-deck-loadout.mjs` (it already launches an
  isolated server with `ALLOW_DEBUG_SCENARIOS=1` + `PERSISTENCE_BACKEND=memory`
  and a vite client on a chosen port) rather than reinventing them.
- Depends on sub-ticket 01's hooks: the `quest-objective-near-complete` debug
  scenario and the `objective` / `runObjectiveComplete` / `lastRunSummary` fields
  on `__AUTOGAME_HARNESS_STATE__`.
- Use existing in-page helpers only: `window.__requestDebugScenarioForTest(name)`
  and `window.__AUTOGAME_HARNESS_STATE__()`. For attacking the enemy, drive the
  same input path the other combat smoke scripts use (keyboard/card-slot input on
  `page`); the scenario in 01 guarantees the player spawns with a usable attack
  and full HP adjacent to the single grunt.
- Output dir: `game/docs/walkthroughs/quest-completion/` (create with
  `fs.mkdirSync(..., { recursive: true })`), matching the convention used by
  `test-keyitems-capture.mjs`.
- Optionally wire a `test:smoke:quest-completion` script entry in
  `game/package.json` next to the other `test:smoke:*` scripts (only if it fits
  cleanly alongside them; do not restructure existing scripts).
- This is the only sub-ticket permitted to commit a permanent smoke script; it
  belongs alongside the existing `game/client/scripts/*.mjs` smoke tests.

## Verification: code
