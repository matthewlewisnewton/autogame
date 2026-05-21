# Capture plan: exercise monster card in visual capture

After fixing the `monster-card` debug scenario (sub-ticket 04), the visual capture must actually play a monster card to provide browser-level proof. Round-2 capture used `summon-ready` (no monster in hand), so `pressCard` was skipped and probes showed an unchanged hand.

## Acceptance Criteria

- A clean capture run using `debugScenario=monster-card` produces `metrics.json` with a final probe documenting: (a) monster slot card id before use, (b) a different replacement card id in that slot after `pressCard` + wait, (c) no client-side `drawCard` call in between.
- `screenshot.log` shows no `[pressCard] ... skipping press` for `cardType: "monster"`.
- `metrics.json` `"ok": true` and capture completes without error.

## Technical Specs

- **File:** `lobby.png/capture-plan-gemini.txt` — verify `connectPlayer` for player A uses `scenario: "monster-card"` (already committed; this sub-ticket ensures the scenario actually works so the capture succeeds).
- No code changes required beyond sub-ticket 04. This sub-ticket is a **re-capture** to produce visual proof once the scenario is fixed.

## Verification: code
