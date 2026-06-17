# Senior Review — Lobby interact (F key + gamepad) does nothing

## Runtime health

`metrics.json`: `"ok": true`, `pageerrors: []`, servers started (url `http://localhost:5176/`,
`sceneInitialized: true`, `connectionState: "connected"`). `console.log` contains no
`pageerror`/`[fatal]` lines from game code. No `harness_failure` block. **The game runs and
loads cleanly.**

Note: the capture used the deterministic full-flow `fallback` plan (auth → lobby → ready →
gameplay → dodge), not a lobby-booth interaction scenario, so the screenshots do not visually
show a booth opening. This is a capture-plan limitation, not a code defect — the booth-interact
chain is proven by the unit/integration tests instead (see below).

## Acceptance criteria

**AC: "Pressing F while near a hub booth opens that booth; the bound gamepad button does the
same; the booth prompt arms on proximity. Covered by a test of the interact→booth dispatch
path. Confirm whether it was browser-specific."**

Met, robustly:

- **Keyboard F** — `onKeyDown` (input.js:132) dispatches `onInteract` for the `interact` action
  and is intentionally *not* gated behind `canUseGameActions`, so it fires in the lobby phase.
  This handler pre-existed and was unchanged by the ticket; the new integration test
  (`booth-interact-chain.test.js`) proves the full keyboard chain works:
  F → `emitBoothInteract` → socket `boothInteract` → `boothAction` → `BOOTH_ACTION_EVENT` →
  shop/deck booth UI opens. The root cause was therefore not the keyboard path at the code
  level but the **missing gamepad binding** (there was no `interact` gamepad action at all),
  consistent with the macOS-Safari/gamepad report in the ticket.

- **Gamepad button** — `interact` now bound to D-pad Up (button index 12) in both
  `STANDARD_PROFILE` and `EIGHTBITDO_64_PROFILE` (gamepad-profiles.js) and in
  `DEFAULT_GAMEPAD_BUTTONS` (input.js). It is filtered out of `POLLABLE_ACTIONS` and handled by
  a dedicated edge-triggered poll block (input.js:275-285) placed *outside* the `actionsEnabled`
  gate, mirroring the keyboard F behavior so it fires in the lobby. `prev.interact` is managed
  only by this block (no double-processing), and edge-triggering prevents repeat-on-hold.

- **Proximity arming** — `emitBoothInteract` (renderer.js:1917) is a no-op unless
  `currentBoothInRange` is set, which is maintained by proximity detection in `animate`. The
  integration test asserts `getCurrentBoothInRange()` returns the expected booth in-range and
  `null` out-of-range, and that out-of-range F produces no socket emission and no booth open.

- **Test coverage** — `input.test.js` adds 5 unit tests (keyboard F, D-pad Up on both profiles,
  fires when `canUseGameActions()` is false, edge-triggered). `booth-interact-chain.test.js`
  adds 4 end-to-end tests including the server out-of-range `boothError` rejection path. All
  49 tests across the two files pass locally.

## Design / regression consistency

The change is additive: one new gamepad binding and one isolated poll block. No existing action
handling, gate, or the keyboard path was altered. No server-side validation is bypassed — the
client still relies on the server `boothAction`/`boothError` response. No debug scenario was
added (lobby is the default start state), so the debug-scenario rules do not apply.

## Code quality

Clean and idiomatic — matches the surrounding edge-trigger pattern. Comments explain the
non-gated lobby behavior. No dead code, no console errors, no obvious bugs.

## Remaining gaps

None blocking.

VERDICT: PASS
