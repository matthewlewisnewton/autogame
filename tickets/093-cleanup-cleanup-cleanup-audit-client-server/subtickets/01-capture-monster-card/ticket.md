# Capture plan: exercise monster card type

The round-2 visual capture pressed a fixed slot index (slot 2) for the "after-monster" step, but that slot ended up holding a weapon (`flame_blade`) after the summon replacement shifted cards. The capture plan needs to use `pressCard` with `cardType: "monster"` so the harness resolves the slot by `data-card-type` attribute instead of a hard-coded index.

## Acceptance Criteria

- `capture-plan-gemini.txt` includes a `pressCard` step with `cardType: "monster"` (or equivalent `data-card-type` targeting) instead of a fixed slot index for the monster exercise.
- The final probe in `metrics.json` documents the monster slot's card id before and after use, plus a new replacement card arriving via `stateUpdate` — with no client-side `drawCard` call in between.

## Technical Specs

- **File:** `lobby.png/capture-plan-gemini.txt`
- Add a `pressCard` action step targeting `cardType: "monster"` (the harness already resolves via `data-card-type` on `.card-slot` elements).
- Update the final probe description to verify monster-specific behavior: slot id before/after and new card from `stateUpdate`.

## Verification: code
