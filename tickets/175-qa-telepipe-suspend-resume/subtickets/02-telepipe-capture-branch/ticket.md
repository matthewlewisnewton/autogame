# Wire the Telepipe suspend/resume flow into the harness fallback capture recipe

The top-level QA capture for this ticket only runs the generic two-player
lobby/movement/dodge fallback, so the round artifacts contain no Telepipe
suspend/resume evidence. The smoke script's walkthrough PNGs are gitignored and
never become permanent evidence; the authoritative visual evidence must come
from the round capture itself. Add a Telepipe branch to `fallbackRecipe()` in
`harness/screenshot.mjs` (exactly like the existing world-stage branch) that
drives a SOLO suspend → resume and records the in-dungeon, suspended-lobby, and
resumed-dungeon screenshots plus before/after probes.

## Acceptance Criteria

- `fallbackRecipe()` in `harness/screenshot.mjs` gains a new `isTelepipeTicket`
  detection (computed the same way as `isWorldStageTicket`: a case-insensitive
  regex tested against both the ticket text from `inferTicketFile()` and against
  `outDirAbs`), matching tokens such as `telepipe`, `suspend[-_ ]?resume`, and
  `175-qa-telepipe`.
- A new `else if (isTelepipeTicket) { ... }` branch is added to the same
  `if/else if` chain as the flare/slope/world-stage branches. The existing
  `isSlopeTicket`, `isFlareBeaconTicket`, and `isWorldStageTicket` branches and
  the default branch are unchanged in behavior; the new branch is mutually
  exclusive with them. Guard the other detections with `!isTelepipeTicket` (the
  same shadowing guard already used for `isWorldStageTicket`) so this ticket's
  own prose (which mentions portals/suspend) cannot make another branch fire.
- Because a SOLO extraction is required to suspend (a solo extracted player
  leaves zero active players → `maybeSuspendRun`), the Telepipe branch builds its
  OWN solo `steps` array (player `A` only — it must NOT reuse the two-player
  `baseSteps`, which connect player `B` and would keep the run active). The solo
  steps do all of, in order:
  - `connectPlayer` A, `wait`, `registerUser` A, `loginUser` A, `wait`,
    `createLobby` A, `wait` (no player B at all),
  - `readyAll` (readies the single connected player → solo deploy),
    `waitForGame` A,
  - `emitScenario` A with `scenario: 'telepipe-ready'` (puts a `telepipe` card in
    hand slot 0), then `wait`,
  - `screenshot` A named `01-in-dungeon` showing the solo player in the dungeon,
  - `probe` A whose description records the PRE-SUSPEND state: player `x`/`z`,
    `enemyHp` count, and `layout` (profile + seed),
  - place the portal (`pressKey` A `key: '1'`) then one or more `move` A steps
    (e.g. `key: 'w'`) with a `wait` so the server proximity check auto-extracts
    the solo player and suspends the run (mirror the place-then-nudge pattern in
    `game/client/scripts/test-telepipe-suspend-resume.mjs`),
  - `wait` long enough for `suspendRunToLobby` to fire (≥ ~2500 ms past portal
    placement, since `PORTAL_PLACEMENT_GRACE_MS` must elapse first),
  - `screenshot` A named `02-suspended-lobby` showing the lobby after the run
    suspended,
  - `probe` A whose description records the suspended `runStatus`/
    `suspendedRunSummary` (questId, questName, objective totalEnemies/
    defeatedEnemies),
  - `readyAll` again (re-deploy → `restoreRunCheckpoint` resumes the run),
    `waitForGame` A,
  - `screenshot` A named `03-resumed-dungeon` showing the resumed dungeon,
  - `probe` A whose description asserts the resumed state preserves the run
    (same `layout` seed/profile and enemy set as the pre-suspend probe, and no
    lingering `runStatus === 'suspended'`).
- The branch sets a distinct `summary` string mentioning the Telepipe
  suspend/resume capture.
- A capture run for this ticket produces a `metrics.json` whose `scenarios`
  array contains `"telepipe-ready"`, whose `screenshots` include the
  `01-in-dungeon`, `02-suspended-lobby`, and `03-resumed-dungeon` entries, and
  whose `probes` show the suspend → resume transition — i.e. the round artifacts
  are no longer only the lobby/movement/dodge fallback.
- Existing server + client tests still pass and the game starts and loads
  cleanly (no new `pageerrors`).

## Technical Specs

- `harness/screenshot.mjs`, function `fallbackRecipe()` (the `if (isFlareBeaconTicket)
  … else if (isSlopeTicket) … else if (isWorldStageTicket) …` chain, ~lines
  336–417): add the `isTelepipeTicket` boolean and the new `else if` branch as
  described. Model the branch structure and the `!isTelepipeTicket` guards on the
  existing world-stage code right above it.
- Use ONLY the recipe step vocabulary already handled in `executeRecipe`
  (`connectPlayer`, `registerUser`, `loginUser`, `createLobby`, `readyAll`,
  `waitForGame`, `emitScenario`, `pressKey`, `move`, `wait`, `screenshot`,
  `probe`). `readyAll` (~line 724) clicks `#ready-btn` on every connected page,
  so with only player A connected it deploys solo and (after re-suspend) resumes.
  `emitScenario` (~line 739) calls `window.__requestDebugScenarioForTest(name)`;
  `'telepipe-ready'` is an existing scenario in `game/server/index.js`
  `DEBUG_SCENARIOS` (~line 427) and matches `SCENARIO_RE`. Debug scenarios are
  already permitted for the harness capture, so no server change is needed.
- The suspend path is server-side: placing the telepipe (key `1`) then walking
  into it triggers `tryEnterTelepipe` → `maybeSuspendRun` → `suspendRunToLobby`
  for a solo player; re-readying calls `restoreRunCheckpoint`. Do NOT modify any
  server suspend/resume logic — this branch only drives and screenshots it.
- Do NOT modify `harness/steps/screenshot.py` (the forced
  `CAPTURE_PLAN_AGENT=fallback` is correct — the fallback recipe is what must
  learn this flow). Do NOT touch the passed sub-ticket 01 files
  (`game/client/scripts/test-telepipe-suspend-resume.mjs`, `game/package.json`,
  `game/docs/walkthroughs/telepipe-suspend-resume/`).

## Verification: code
