# Telepipe suspend → resume QA smoke test

Add a headless Playwright smoke test that drives the real game through a solo
Telepipe SUSPEND, then RESUME, and asserts that run state (quest, enemies, run
status) is preserved across the suspend → resume boundary. Capture screenshots
and a JSON state snapshot as evidence. This is a QA playthrough ticket: the
deliverable is a permanent smoke script that lives alongside the other
`game/client/scripts/test-*.mjs` files.

## Acceptance Criteria

- A new smoke script `game/client/scripts/test-telepipe-suspend-resume.mjs`
  exists and runs end-to-end without throwing, exiting non-zero on any failed
  assertion.
- The script uses ISOLATED high ports so live runs are untouched: it launches
  (or expects, via env) the server on a high `PORT` (e.g. 32xx) and the vite
  client on `--port 52xx --strictPort` with `HARNESS_GAME_PORT` matching, and
  starts the server with `ALLOW_DEBUG_SCENARIOS=1`. It cleans up every process
  it spawns (including on failure).
- The script reuses the established flow: `POST /api/register`, inject the token
  into `localStorage('autogame_token')`, create a lobby, deploy solo, and wait
  for `__AUTOGAME_HARNESS_STATE__().phase === 'playing'`. It applies the
  `telepipe-ready` debug scenario (via `?debugScenario=telepipe-ready` and/or
  `window.__requestDebugScenarioForTest('telepipe-ready')`) so a `telepipe` card
  is in hand slot 0.
- The script captures a PRE-SUSPEND snapshot from `__AUTOGAME_HARNESS_STATE__()`
  recording at least: `phase`, `enemies` (ids + hp), and `player` position
  (`x`/`z`).
- The script places the telepipe (hand slot key `1`), moves the solo player into
  the portal to extract, and asserts the run SUSPENDS: a later snapshot shows
  `runStatus === 'suspended'` (or `phase === 'lobby'` with a non-null
  `suspendedRunSummary` carrying `questId`/`questName`/`objective`).
- The script re-deploys (Ready/Deploy) to RESUME, waits for
  `phase === 'playing'`, and asserts state is PRESERVED: the resumed
  `suspendedRunSummary`/quest matches the suspended one, and the resumed
  `enemies` match the pre-suspend enemy set (same count and ids; hp preserved
  for enemies that were not defeated). The script asserts no
  `runStatus === 'suspended'` lingers after resume.
- Evidence is saved under
  `game/docs/walkthroughs/telepipe-suspend-resume/`: screenshots for the
  in-dungeon, suspended-lobby, and resumed-dungeon states, plus a
  `state-snapshot.json` containing the pre-suspend, suspended, and post-resume
  snapshots.
- A `test:smoke:telepipe-suspend-resume` script is added to `game/package.json`
  pointing at the new file.
- Existing server + client tests still pass and the game starts/loads cleanly
  (no new console `TypeError` on `stateUpdate` during the run).

## Technical Specs

- New file: `game/client/scripts/test-telepipe-suspend-resume.mjs`.
  - Model it on `game/client/scripts/p1-telepipe-tier2-v2.mjs` and
    `game/client/scripts/test-keyitems-capture.mjs` (auth helper, `loginPage`
    via `localStorage('autogame_token')` + reload, `__AUTOGAME_HARNESS_STATE__`
    polling, `chromium.launch({ headless: true })`).
  - Solo flow only — NO second player. Suspend is reached because a solo
    extracted player leaves zero active players, so
    `tryEnterTelepipe` → `maybeSuspendRun` → `suspendRunToLobby` fires
    (`game/server/progression.js:3047`, `:3005`, `:3053`). Resume is reached by
    re-readying, which calls `restoreRunCheckpoint`
    (`game/server/progression.js:3385`, `:2956`).
  - Place the portal with hand slot key `1`, then drive WASD to leave the
    placement grace radius and re-enter the portal (see the `tapWasd` /
    proximity pattern in `p1-telepipe-tier2-v2.mjs`); poll
    `__AUTOGAME_HARNESS_STATE__()` for `runStatus`/`suspendedRunSummary` rather
    than relying on UI banner text alone.
  - Spawn the server (`game/server/index.js`) with
    `ALLOW_DEBUG_SCENARIOS=1 PORT=<high>` and the client
    (`vite --port <high> --strictPort`) with `HARNESS_GAME_PORT` set, mirroring
    how other smoke scripts isolate ports; tear both down in a `finally`.
  - Read state via the existing hooks only — `window.__AUTOGAME_HARNESS_STATE__`
    (`game/client/main.js:3919`, exposes `phase`, `runStatus`,
    `suspendedRunSummary`, `telepipe`, `enemies`, `player.x/z`) and
    `window.__requestDebugScenarioForTest` (`game/client/main.js:1563`). Do NOT
    add new production hooks to `game/client/main.js` or
    `game/server/index.js`.
- Edit: `game/package.json` — add
  `"test:smoke:telepipe-suspend-resume": "node client/scripts/test-telepipe-suspend-resume.mjs"`
  alongside the other `test:smoke:*` entries.
- Evidence dir: `game/docs/walkthroughs/telepipe-suspend-resume/` (screenshots +
  `state-snapshot.json`).
- Do NOT modify server suspend/resume logic; this ticket only verifies existing
  behavior.

## Verification: code
