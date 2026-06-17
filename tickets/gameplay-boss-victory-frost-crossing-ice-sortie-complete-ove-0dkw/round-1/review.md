# Senior Review — frost_crossing (ice) Sortie Complete overlay clobbered by returnToGuildLobby

## Runtime health (gate)

- `metrics.json`: `ok: true`, `pageerrors: []`, no `harness_failure` block, servers started on :5175.
- `pageerrors.json`: empty.
- `console.log`: no `[fatal]` / `pageerror` / uncaught exception lines. The only noise is a
  pre-auth `401 Unauthorized` + a `WebSocket closed before established` during the initial
  handshake — benign reconnect noise, not a game-code defect.
- `server.log`: no errors.

Game starts and loads cleanly. Gate passes.

Note: the capture fell back to the deterministic `telepipe-ready` suspend/resume scenario
(`capturePlanSource: "fallback"`) rather than an ice-victory capture, so there is no
`10-victory.png` visual of the Sortie Complete overlay this round. This is a harness
capture-plan-generation limitation, not a code defect — the runtime ran cleanly, and the
acceptance criterion itself is robustly proven by the unit tests below (which I ran
independently: 9/9 passing). It is recorded as a nit, not a blocker.

## Per-criterion findings

The ticket's acceptance criterion (from EXPECTED + Verification): after frost_crossing (ice,
Tier-1 stage_boss) boss defeat, the run-summary overlay (`#run-summary-overlay`,
`#summary-status` = "Sortie Complete") must STAY visible — it must not be clobbered back to
`display:none` by a racing lobby-phase STATE_UPDATE — so the player sees rewards/card choices
and can return to hub.

**Root cause correctly addressed (server, primary fix).** `checkRunTerminalState` previously
set `_gameState.run.status = status` *before* emitting RUN_COMPLETE, so a per-tick snapshot
could expose `victory` (and the frost-crossing flow's lobby phase) before the client received
the summary. The fix moves the status publish to *after* the emit, and adds
`ensureTerminalRunStaysInDungeon()` (invoked from both `stateSnapshot` and `hotStateSnapshot`)
which forces a terminal run back to `PHASES.PLAYING`. The server therefore no longer emits a
lobby-phase STATE_UPDATE for a terminal run at all — the race source is removed, not just
masked. Verified by `frost_crossing_victory_phase.test.js`:
- "keeps gamePhase playing after checkRunTerminalState resolves victory"
- "does not emit lobby-phase stateUpdate payloads after runComplete until returnToLobby"
- "corrects spurious lobby drift in hot snapshots while the run is terminal"
- "emits runComplete before hot snapshots expose terminal run.status" (ordering invariant)

**Defense-in-depth (client).** `stateHandlers.js` now skips `returnToGuildLobby` when a
terminal run summary is active unless the server has actually cleared `state.run`; and
`returnToGuildLobby` itself only hides `runSummaryOverlay` when no terminal summary is active
(or when `dismissRunSummary` is explicitly passed on real hub return). A reconstruction path
(`needsTerminalRunSummaryFromState` / `buildRunSummaryFromState`) re-synthesizes the overlay
from a terminal server snapshot if the client ever missed the RUN_COMPLETE event. Verified by
`run-summary-lobby-race.test.js`:
- "keeps Sortie Complete visible when lobby stateUpdate follows showRunSummary"
- "synthesizes Sortie Complete from a terminal run snapshot when runComplete was missed"
- "Return to Hub dismisses the overlay after server clears the run" (normal dismissal still works)

**No regression to suspend / give-up / hub-return.** `suspendRunToLobby` and `maybeSuspendRun`
now bail on terminal runs (a victory run can no longer be suspended back to lobby — verified by
test). `returnPlayersToLobby` and `giveUpRun` were reordered to `delete state.run` *before*
`setGamePhase(LOBBY)`, so the snapshot guard cannot flip the phase back to playing during hub
return — the normal return path still ends in lobby with the overlay dismissed and
`lastRunSummary` cleared.

**No regression to other presets.** `ensureTerminalRunStaysInDungeon` is a no-op unless the run
is terminal AND not already in playing phase, so fire (defeat_enemies) and spire (stage_boss)
victory flows — which already worked — are untouched.

**Debug scenario (`frost-crossing-boss-low-hp`).** The only change is a guard: if the run is
already terminal, emit current state instead of re-running last-enemy setup. It is gated behind
the existing `ALLOW_DEBUG_SCENARIOS` debug path (the URL/`debugScenario` entry point only), does
not create a new entry point, and does not bypass server-side victory validation — the real
victory path (`defeatFrostCrossingBoss` → `cleanupAfterDamage` → `checkRunTerminalState`) is
exercised by the non-debug tests, and `setupFrostCrossingBossLowHpDebug` only sets boss HP low
so the player still lands the killing blow. Reachability and invariants are intact.

**Consistency with design.** Keeping the player in the dungeon on the victory screen until an
explicit "Return to Hub" matches the documented Sortie Complete flow and the behavior already
shipped for fire/spire. No requirements regression.

## Remaining gaps

None blocking. All acceptance behavior is proven by 9/9 passing unit tests (server + client),
which I ran independently, and the captured run starts/loads cleanly.

VERDICT: PASS
