# Senior Review — gameplay/fire (ember_descent): run flips to 'failed' during telepipe-new-sortie

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, `capturePlanValid: true`. Servers started, scene initialized (`sceneInitialized: true`, `hasCanvas: true`, `canvasCount: 2`).
- `console.log` / `client.log`: no `pageerror`, `[fatal]`, uncaught exception, or game-code error. Only benign noise (a 401 on an unauthenticated resource and a websocket-closed warning during connect).
- `pageerrors.json`: `[]`.
- `server.log` shows the exact correct sequence: `[telepipe] placed → player extracted → [run] checkpoint captured → [run] checkpoint restored`. **No `run failed`** — the precise inverse of the reported bug.

The captured run is clean and runnable. Gate passes.

## Per-criterion findings

The ticket is a bug report; its acceptance criteria are the EXPECTED behavior ("after victory, placing a telepipe should SUSPEND the run; runStatus must not flip to 'failed', suspendedRunSummary populated, run resumable"). The work was decomposed into: (01) game-side combat-exhaustion suppression while a telepipe awaits extraction, (02) isolate the fire harness deploy from live combat, (03) regression tests.

**Telepipe suspends instead of flipping to 'failed' — MET.**
Capture probe 2 (suspended state): `runStatus: "suspended"`, `suspendedRunSummary` populated (`questId: training_caverns`, `questName: Initiate Vault`, objective echoed), `resumeBtnUsable: true`, `abandonRunBtnUsable: true`, `phase: lobby`. The `02-suspended-lobby.png` screenshot shows the resumable lobby (Resume sortie / Abort Sortie / Return to Registry).

**Run is resumable with state preserved — MET.**
Capture probe 3/4 (resumed + preservation): `runStatus: "playing"`, `suspendedRunSummary: null`, same layout seed `352369970`/profile, telepipe present, and the `preservation` block reports `preservedIds: 2`, `missingIds: []`, `hpChangedIds: []`, objective preserved. The capture is configured to FAIL on any restore mismatch and did not.

**(01) Combat-exhaustion failure deferred while telepipe awaits extraction — MET (verified, pre-existing).**
`game/server/progression.js` already contains `isRunAwaitingTelepipeExtraction()` and the early `return false` in `isPlayerCombatExhaustionFailureReady()` (the single choke point used by both `tickCombatExhaustionGrace()` and `checkRunTerminalState()`). This was introduced by a prior ticket (`telepipe-...-m-dup4/01`), so sub-ticket 01 was correctly a "verify, don't rewrite" — progression.js is untouched in this ticket's diff, which is the right outcome. The behavior is locked by `server.test.js` `describe('telepipe vs combat exhaustion')` (4 tests, all pass), which assert `run.status === 'playing'` through `checkRunTerminalState`/`tickCombatExhaustionGrace` with an empty hand+deck while a telepipe is placed, and that suspend still works — these assertions do NOT depend on godmode, so the exhaustion guard is genuinely exercised.

**(02) Fire harness deploy isolated from live combat — MET.**
`game/server/debugScenarios.js`: the `fire-telepipe-ready` block now sets `hooks.suppressWavesAfterDeploy = true`, mirroring `frost-crossing-telepipe-ready`. The pre-existing `suppressWavesAfterDeploy` branch in `checkAllReadyInner` (~L3979) replaces enemies with a single stationary dummy grunt (hp 500), clears scripted-wave state, and sets `player.debugGodmode = true`. `harness/validate/lib/telepipe.mjs`: `suspendViaTelepipe` now calls `enableGodmode(page)` before placing the portal so godmode survives any prior playthrough step. This addresses the true cause of the harness failure: the resource-exhausted bot was being killed by live fire waves during the scripted ~30s suspend walk (player-death → run failed), which is a test-driver artifact, not a defect in the suspend logic.

**(03) Regression tests — MET.**
- `server/test/server.test.js` retains the `telepipe vs combat exhaustion` block (4 tests pass).
- `server/test/debug-scenarios.test.js` adds `fire-telepipe-ready deploy isolates combat...` (passes): asserts exactly one dummy grunt, `debugGodmode === true`, `suppressWavesAfterDeploy` active, scripted waves cleared, `checkRunTerminalState()` keeps `run.status === 'playing'` with an exhausted hand+placed telepipe, and `tryEnterTelepipe` suspends into a checkpoint preserving the run id and `status: 'playing'`.

## Debug-scenario invariant check

`fire-telepipe-ready` is a `?debugScenario=` shortcut. It is gated behind the debug path (`debugScenarioAllowed: true` in capture; normal play never sets it). The same end-state (a suspended, resumable run) is reachable in normal gameplay: a real player places a telepipe and walks into it, and the combat-exhaustion guard ensures an out-of-cards player still suspends rather than failing. The scenario's godmode/wave-suppression only protects the harness's automated walk from enemy damage — it does **not** short-circuit the suspend path itself: `tryEnterTelepipe`, `maybeSuspendRun`, and checkpoint capture/restore are all fully exercised (server-side, in tests and in the live capture). No invariant is weakened.

## Consistency / regressions

- Consistent with the suspend/resume design (telepipe → checkpoint → hub → resume), no foundation regression. `frost-crossing-telepipe-ready` behavior is unchanged (its hooks were already this shape).
- Diff is appropriately narrow: 1 line of game code (debug scenario hook), 1 line of harness driver, plus tests. No production game-logic was rewritten because the needed guard already existed.

## Remaining gaps

None blocking. The captured run is clean and proves the reported bug is fixed (suspend instead of fail, resumable, state preserved); all relevant unit tests pass.

VERDICT: PASS
