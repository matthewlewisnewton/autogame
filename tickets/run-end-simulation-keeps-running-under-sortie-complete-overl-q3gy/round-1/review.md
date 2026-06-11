# Senior Review — run-end: simulation keeps running under 'Sortie Complete' overlay

## Runtime health (gating check)

- `metrics.json`: `"ok": true`, servers started, `pageerrors: []`, no `harness_failure`.
- `console.log`: no `pageerror` / `[fatal]` lines. The single `409 (Conflict)` is
  benign auth-replay noise during the smoke login; the scene initializes
  (`[initScene] Initializing Three.js scene...`) for both clients.
- Note: the capture used the deterministic **fallback** smoke flow
  (`capturePlanSource: "fallback"`) which never reaches victory, so the overlay
  state is not exercised in the screenshots. The fix was therefore verified
  directly against the live working-tree code and the unit tests below.

Game starts and loads cleanly → runtime-health gate passes.

## Acceptance Criterion

> After victory fires, either player movement/pickup is disabled once the
> summary overlay is visible, or the summary's money/reward lines match the
> wallet delta… no interactive sim actions are possible behind the modal.

The implementation chose **option A — lock all interactive sim input once the
run reaches a terminal status / the summary overlay is visible.** It does this
with defense-in-depth on both server (authoritative) and client (UX):

**Server (authoritative) — `isActiveRun(state)` = run is `playing` (or no run):**
- `simulation.js applyPlayerMovement`: `if (inPlaying && !isActiveRun(state)) return;` — movement ticks stop.
- `socketHandlers/runHandlers.js` MOVE handler: `if (!isActiveRun(state)) return;`.
- `runHandlers.js` LOOT_PICKUP: `if (state.run && state.run.status !== 'playing') return;` — **this directly closes the divergence bug** (no post-victory pickups can land, so wallet can't outrun the frozen summary).
- `keyItemEffects.js handleUseKeyItem`: rejects with `reason: 'run_terminal'` — fixes the "cooldown HUD flashes while doing nothing" symptom at the source.
- `cardEffects.js handleUseCard:284` and DISCARD_CARD: already gate on `run.status === 'playing'`, so casting/discarding behind the modal is also blocked.
- `progression.js checkRunTerminalState`: zeroes `inputActive/inputDx/inputDz` on every player the instant the run goes terminal — belt-and-suspenders so no buffered input keeps the avatar drifting.

**Client (UX) — `isDungeonInputBlocked()` = terminal `run.status` OR overlay visible:**
- `renderer.js updateMyPlayer`: when blocked, movement is nulled, sim velocity/accumulators reset, and no MOVE is emitted.
- `renderer.js animate`: loot-proximity auto-pickup emit is skipped while blocked.
- `main.js canUseGameActions()`: returns false when the overlay is visible, which gates attacks (`pointerdown:3578`), card slots, key-item use (`onUseKeyItem` via input.js `actionsEnabled`), lock-on, deck toggle.
- `main.js showRunSummary`: on `victory` sets `gameState.run.status = 'victory'` and on `failed` sets `'failed'`, and makes the overlay `display:flex` — both signals that drive `isDungeonInputBlocked` engage together. Terminal statuses are only `victory`/`failed` (exhausted maps to `failed`), so all terminal cases are mirrored.

**Result:** behind the modal, movement, loot pickup, key-item use, card cast and
discard are all inert. Because pickups are blocked, the summary's money line and
the wallet can no longer diverge. AC is fully and robustly met.

## Debug scenario review (`run-victory`)

A new `?debugScenario=run-victory` was added. All three requirements hold:
- **Dev-gated only:** routed through the pre-existing `isDebugScenarioAllowed`
  (`ALLOW_DEBUG_SCENARIOS=1`, non-production, localhost only); the URL param is
  the sole entry point. Normal gameplay never references it.
- **Normal path still reaches the same state:** `setupRunVictoryDebug` marks the
  objective complete, clears enemies/minions, then calls the *same*
  `checkRunTerminalState()` that real combat invokes when the last hostile dies
  (confirmed by integration test "runComplete is emitted after the last enemy is
  defeated via a weapon card"). It is a shortcut to the real terminal path, not a
  substitute.
- **No invariants weakened:** it doesn't skip persistence, reward, or
  replication — it triggers the genuine victory pipeline.

## Design / regression check

Consistent with the run-end / Sortie Complete flow; no foundation regression.
Full server suite green (438 passed, 0 failed) including movement, key-item,
loot, and run-terminal integration tests. The four ticket-specific suites pass:
`run_terminal_input.test.js`, `renderer-run-summary-input.test.js`,
`run-summary-input-lock.test.js` (11/11). The `Failed to parse URL
/models/player.glb` line in the client run is benign jsdom asset-fetch noise.

## Code quality

Changes are small, well-commented, and symmetric across client/server. The
`isActiveRun` helper correctly returns `true` for the no-run (lobby) case so it
doesn't accidentally freeze lobby movement. No dead code, no console errors.

## Remaining gaps

None. The acceptance criterion is fully and robustly satisfied, the game runs
cleanly, and the change is well-tested.

VERDICT: PASS