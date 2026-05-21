# Run clean capture to generate fresh metrics.json for monster-card

The current `lobby.png/metrics.json` is stale from a pre-monster-card run (only 3 screenshots, no `04-after-monster-card`, empty scenarios array). The capture plan (`capture-plan-gemini.txt`) is already correct — it uses `pressCard` with `cardType: "monster"` and the `monster-card` debug scenario. A clean capture run will regenerate `metrics.json` with the monster-card probe documenting slot id before/after and the replacement card from `stateUpdate`.

## Acceptance Criteria

- `lobby.png/metrics.json` contains at least 4 screenshots including `04-after-monster-card.png`.
- The final probe in `metrics.json` documents the monster slot card id before and after use, showing a new replacement card arrived via `stateUpdate` (no client-side `drawCard` between).
- The `scenarios` field in `metrics.json` includes `"monster-card"`.

## Technical Specs

- **No code changes required.** The capture plan (`lobby.png/capture-plan-gemini.txt`) and harness (`harness/screenshot.mjs`) already support `cardType: "monster"` resolution.
- Execute the capture run from `lobby.png/` using the existing harness: `node harness/screenshot.mjs lobby.png/capture-plan-gemini.txt` (or the project's standard capture command).
- Verify the regenerated `lobby.png/metrics.json` meets the acceptance criteria above.

## Verification: code
