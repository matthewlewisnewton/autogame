# Probe wind-up card input-lock and charge telegraph (308)

Extend the spire-ascent validation driver to grant and play a wind-up card
(a card with `windUpMs > 0`, e.g. the magma wind-up card) during the spire run,
and probe that hand input is locked during the wind-up commitment and that the
charge/wind-up telegraph is presented. Driver + read-only instrumentation only.

## Acceptance Criteria

- A probe grants a wind-up card, plays it, and records a `windUp` section in
  `run-summary.json` containing: the card id, its `windUpMs`, that hand input was
  locked during the wind-up window (`isHandInputLocked()` true / a second card
  play is rejected mid-wind-up), and that input unlocked after the window.
- The probe asserts input is locked during wind-up and unlocked afterward, and
  fails the run if input is never locked (the input-lock guard regressed).
- The probe records that the wind-up charge telegraph is presented (the
  `card-windup-hint` element / wind-up tooltip is rendered for the slot, or the
  slot carries the wind-up telegraph class), so the diff shows the telegraph
  exists, not just the timing.
- A screenshot `05c-windup.png` is captured during the wind-up window and listed
  in `run-summary.json`.
- Probe is gated behind a preset flag; other presets unaffected.

## Technical Specs

- `harness/validate/presets/spire-ascent.mjs` — add a flag (e.g.
  `probeWindUp: true`, naming the wind-up card-grant scenario such as
  `magma-windup-ready`).
- `harness/validate/lib/windUpProbe.mjs` (new) — export a probe that grants the
  wind-up card via `requestScenario`, triggers the card, and polls `readHarness`
  to observe the input-lock state and telegraph presence, capturing the
  screenshot mid-window. Reuse `readHarness` and `writeScreenshot`.
- `game/client/main.js` `__AUTOGAME_HARNESS_STATE__()` — expose read-only
  wind-up state needed by the probe: the active card's `windUpMs`, a
  `handInputLocked` boolean (from `isHandInputLocked()` in
  `game/client/hand.js`), and whether the slot is showing the wind-up
  telegraph (e.g. `card-windup-hint` present). Additive instrumentation only —
  the input-lock and telegraph logic itself is NOT changed.
- `harness/validate/playthrough.mjs` — call the probe in the spire combat phase
  when the flag is set; fold result + screenshot into `run-summary.json`.

## Verification: code
