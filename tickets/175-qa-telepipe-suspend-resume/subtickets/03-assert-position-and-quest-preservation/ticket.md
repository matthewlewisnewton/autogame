# Assert player-position semantics and quest-objective preservation in the Telepipe smoke

The Telepipe suspend/resume smoke records player position and a suspended quest
summary but never ASSERTS the intended position behavior on resume, nor compares
quest/objective progress across the suspend → resume boundary. Strengthen
`game/client/scripts/test-telepipe-suspend-resume.mjs` so it explicitly verifies
both, and record the new comparison in the state snapshot evidence.

## Acceptance Criteria

- The smoke captures the PRE-SUSPEND quest-objective progress and the suspend
  portal position so they can be compared after resume. Concretely: it records
  the pre-suspend undefeated-enemy count (objective progress is
  `defeated 0 / total N`, derivable from the pre-suspend `enemyHp` set since no
  enemy was defeated this run) and the telepipe portal `x`/`z` placed during
  suspend (read from the suspended snapshot's `telepipe`, or from the post-resume
  snapshot which carries the restored `telepipe`).
- The smoke ASSERTS quest/objective preservation across resume, not merely the
  presence of a well-formed suspended summary:
  - The suspended `suspendedRunSummary.objective` reflects pre-suspend progress —
    for the `defeat_enemies` objective, `objective.totalEnemies` equals the
    pre-suspend enemy count and `objective.defeatedEnemies === 0` (none defeated).
  - After resume, objective progress is preserved: the resumed run still has the
    same number of undefeated enemies as pre-suspend (same enemy ids, none newly
    defeated), so the implied `defeated/total` is unchanged. This is asserted
    against the resumed `enemyHp` set (extending, not replacing, the existing
    enemy-id/hp preservation checks).
- The smoke ASSERTS the intended resumed-player POSITION semantics rather than
  only recording them: after resume the player is repositioned CLEAR of the
  restored telepipe portal (it is NOT left inside the portal radius), matching
  `repositionPlayersAwayFromPortal` in `game/server/progression.js`. Concretely,
  assert that the straight-line distance from the resumed player `(x,z)` to the
  restored `telepipe` `(x,z)` is greater than the portal extraction radius
  (`telepipe` card `radius` = 2.5 in `game/server/progression.js`), i.e. the
  resumed player would not immediately re-extract, AND that `runStatus` is
  `playing` (not `suspended`) after a short settle.
- On any of these assertions failing, the script exits non-zero with a clear
  message (reuse the existing `assert(cond, msg)` helper).
- The `state-snapshot.json` written under
  `game/docs/walkthroughs/telepipe-suspend-resume/` is extended to include the
  new comparison evidence — e.g. an `objectiveProgress` block recording
  pre-suspend total/defeated, suspended summary total/defeated, and post-resume
  remaining-undefeated, plus a `resumedPlayerPortalDistance` value — so the
  preservation is visible in the committed evidence, not just in console logs.
- The script still runs end-to-end on isolated high ports, still tears down
  every process it spawns in `finally`, and still passes its existing
  suspend/resume, layout-seed/profile, enemy-set, and no-`TypeError` assertions.
- Existing server + client tests still pass and the game starts and loads
  cleanly.

## Technical Specs

- Edit ONLY `game/client/scripts/test-telepipe-suspend-resume.mjs`:
  - The `snapshot(state)` helper already records `player.{x,z}`, `telepipe`,
    `enemies` (ids+hp via `enemyHp`), and `suspendedRunSummary`; the playing-phase
    harness state does NOT expose a live quest objective, so derive pre-suspend
    objective progress from the enemy set (`total = pre.enemies.length`,
    `defeated = 0`) and read the suspended objective from
    `suspended.suspendedRunSummary.objective` (`totalEnemies`/`defeatedEnemies`,
    see `game/client/main.js:487` for the `defeat_enemies` shape).
  - Add the objective-progress assertions near the existing post-resume block
    (~lines 281–306). Add the position assertion using `pre`/`suspended`/
    `resumed` snapshots: compute
    `Math.hypot(resumed.player.x - telepipe.x, resumed.player.z - telepipe.z)`
    where `telepipe` is the restored portal (`resumed.telepipe` ?? `suspended`
    portal), assert it exceeds `2.5`, and keep asserting
    `resumed.runStatus !== 'suspended'`.
  - Extend the `state-snapshot.json` payload written at ~lines 314–321 with the
    new `objectiveProgress` and `resumedPlayerPortalDistance` fields.
- Do NOT modify any server suspend/resume logic or the harness capture recipe —
  this sub-ticket only strengthens the smoke's assertions and its snapshot
  evidence. The `2.5` radius is the existing `CARD_DEFS.telepipe.radius`
  (`game/server/progression.js:543`); reposition behavior is
  `repositionPlayersAwayFromPortal` (`game/server/progression.js:1367`).
- Do NOT touch the harness capture branch added in sibling sub-ticket 02
  (`harness/screenshot.mjs`).

## Verification: code
