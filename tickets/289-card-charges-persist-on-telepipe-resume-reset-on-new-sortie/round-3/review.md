## Runtime health

PASS. The round-3 capture proves the game starts and loads cleanly: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite startup, scene initialization, debug-scenario application, and launch-booth ready-up lines; no `pageerror` or `[fatal]` entries were present. Server/client logs were also clean apart from benign dev/runtime noise, and coverage recorded 103 test files / 1635 tests passing.

## Acceptance criteria findings

1. Player spends card charges, takes telepipe-up, returns to hub, redeploys into the same run -> card charges are preserved.

   PASS. The live server path now captures a suspended checkpoint before clearing hub-side transient run state and restores that checkpoint before the fresh-deploy branch in `checkAllReady()`. The checkpoint includes each player's hand, draw deck, desperation state, run id/objective, layout, enemies, loot, effects, and telepipe. The round-3 capture confirms suspend/resume returned to the same run id, same layout seed/profile, same objective, and preserved all 5 baseline enemies with unchanged HP. Server and integration tests cover spent card charges surviving resume for solo and two-player flows.

2. Player starts a NEW sortie (fresh quest/run) -> card charges reset to a fresh deck.

   PASS. A new sortie is available only after the suspended checkpoint is explicitly abandoned. `abandonSuspendedRun()` clears the checkpoint and ready state; the next deploy follows the normal fresh-run branch, which rebuilds each player's draw deck and hand from selected loadouts. Tests assert the new run id differs from the suspended run and every redealt card has `remainingCharges === charges`.

3. Health + magic stones persist in BOTH cases.

   PASS. The restore branch does not overwrite finite `hp` or `magicStones`, and the fresh-deploy branch preserves existing finite vitals instead of resetting them. Tests exercise telepipe resume and abandon-then-new-sortie with non-default HP/MS and verify neither path resets HP to max or MS to the starting amount. This matches the ticket-287 durability rule in `game/docs/design.md`.

4. Server tests covering both paths.

   PASS. The changed tests include focused server coverage for telepipe-resume card-charge preservation, new-sortie charge reset after abandon, and HP/MS regression guards, plus socket integration coverage for the same two-player flows. The round-3 `coverage.log` shows the full suite passed.

## Design and regression review

PASS. The updated `game/docs/design.md` accurately describes the implemented telepipe suspend/resume policy: last active player extraction suspends the run, resume restores the same run/checkpoint including card charges, and Abort Sortie discards the checkpoint so the next deploy is a fresh run with reset card charges. This does not regress the foundation requirements: the captured run rendered a 3D scene, maintained a WebSocket connection, showed the player in the world, and successfully transitioned lobby -> dungeon -> suspended lobby -> resumed dungeon.

## Debug scenario review

PASS. The round-3 capture used the existing `telepipe-ready` debug scenario. It remains gated by the localhost-only `?debugScenario=` client path and server debug-scenario allowlist, and it does not replace the real flow: normal play still reaches the same state by deploying with a Telepipe card, placing the portal, extracting all active players, then readying from the hub to resume. The scenario only prepares a QA-friendly hand/state before normal ready-up and telepipe/resume server logic run, so it does not bypass checkpoint persistence or net-replication invariants.

## Remaining gaps

None.

VERDICT: PASS
