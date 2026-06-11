# Senior Review — combat/balance: deck exhaustion soft-locks a run

## Runtime health (gate)

- `metrics.json`: `"ok": true`, servers started on :5175, `pageerrors: []`,
  no `harness_failure` block.
- `pageerrors.json`: `[]`.
- `console.log`: only `[vite] connecting/connected`, two benign `409 Conflict`
  resource loads (lobby create race), and `initScene`/`launchBooth` logs. No
  `pageerror` / `[fatal]` lines from game code.
- Capture probes show a live, connected run (`connectionState: connected`,
  `sceneInitialized: true`, deck draws working, MS regenerating 49.8→50.4).

The game starts and loads cleanly. Gate passes.

## Acceptance criterion

> A run where the deck+desperation cards are fully consumed and MS is below
> every remaining castable cost either (a) still lets the player attack via some
> baseline action, or (b) auto-resolves to the exhausted/failed state within a
> short grace period; a server test covers the exhausted-with-insufficient-MS
> state.

**Met via option (b).** The implementation:

- `isPlayerCombatExhausted(player)` (`game/server/progression.js:2399`) returns
  true only when the player cannot draw into hand (`canDrawIntoHand` false —
  deck *and* desperation empty or hand full) **and** no hand card is castable.
- `canPlayerCastHandCard` (`progression.js:2386`) correctly rejects a card when
  charges are spent or `magicStones < magicStoneCost`, so a hand holding only a
  50‑MS Signal Familiar at 25 MS reads as uncastable — exactly the reported
  Frost Crossing stall.
- `tickCombatExhaustionGrace(now)` (`progression.js:3406`) is called every game
  tick from `runGameLoopTick` (`index.js:1652`). It stamps `_combatExhaustedSince`
  when a player first becomes exhausted, clears it the moment they recover, and
  fails the run only when **all** in-dungeon players are failure-ready.
- `isPlayerCombatExhaustionFailureReady` preserves the prior immediate-fail
  behavior for the truly-out-of-cards case (`isPlayerOutOfCards` → fail with no
  grace) and adds the new MS-insufficient case gated behind
  `RUN_EXHAUSTION_GRACE_MS` (20 s, `config.js:121`).

The grace window is sound against the real MS regen rate: regen is
`0.005/tick × 20 tps = 0.1 MS/s`, so 25→50 MS takes ~250 s — far longer than the
20 s grace, meaning a genuinely stalled hand is correctly failed rather than
left hanging. Crucially, the recoverable case is also handled: the dedicated
test `clears combat exhaustion grace when MS regen makes a hand card castable`
confirms the timer is dropped (not failed) once MS reaches the card cost, so the
auto-fail does not prematurely kill a run that could still act.

**Server-test coverage is strong** (473/473 passing locally):
- `combat exhaustion detection` block covers empty-hand, MS-insufficient-spell,
  deck-still-drawable, and at-least-one-castable cases.
- `run state` block covers: no immediate fail; fail after grace; `runFailed`
  emission; no fail while desperation deck still drawable; grace cleared on MS
  recovery.
- `setupRunExhaustedDebug` block covers the debug scenario shape and immediate
  fail when grace is pre-aged.

## Design consistency / regression

- Reuses existing `checkRunTerminalState` terminal pipeline and the established
  `inDungeon.every(...)` multiplayer semantics — one stalled player does not
  fail a squad that still has a castable member.
- No change to MS regen, drawing, or card-cast validation; the new logic is
  read-only detection plus a terminal-state trigger. No foundation regression.

## Debug scenario (`run-exhausted`)

- Gated: dispatch table only fires under `ALLOW_DEBUG_SCENARIOS === '1'`
  (`debugScenarios.js:560`); the `?debugScenario=` URL is the only entry point.
- Same end-state reachable through normal play: a real run that empties
  deck+desperation with MS below every cost hits the identical
  `tickCombatExhaustionGrace` → `checkRunTerminalState` path each tick. The
  scenario merely pre-ages `_combatExhaustedSince` to skip the 20 s wait for QA.
- No invariant short-circuit: failure still routes through the real
  `isPlayerCombatExhaustionFailureReady` + `checkRunTerminalState`; it does not
  bypass server validation or the terminal-state emit.

## Code quality

Clean and idiomatic; matches surrounding progression helpers. The previous
broken/misindented `setupRunExhaustedDebug` body was repaired. No dead code, no
console errors.

## Remaining gaps

None blocking. All acceptance criteria are met, the game runs cleanly, and the
fail-state is correctly gated and reachable through normal play. Minor non-
blocking nits recorded separately in `nits.md`.

VERDICT: PASS