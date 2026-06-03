# 179-qa-deck-loadout-applies-to-run

## Difficulty: medium

## Goal

Configure a non-default deck loadout in the lobby/deck editor, start a run, and verify the in-run hand/deck matches the chosen loadout (the selected cards are the ones drawable/equipped). QA playthrough ticket: drive the real game in a headless browser (playwright) and confirm the feature fires. Use ISOLATED high ports so live runs are untouched (e.g. server PORT=32xx, vite --port 52xx --strictPort with HARNESS_GAME_PORT matching). Server needs ALLOW_DEBUG_SCENARIOS=1 for debug helpers. Reuse the existing flow from game/client/scripts/*.mjs: POST /api/register, inject token into localStorage('autogame_token'), create lobby, ready, wait for phase 'playing', then use window.__requestDebugScenarioForTest(...) and window.__AUTOGAME_HARNESS_STATE__() to reach and inspect state. Capture screenshots + a state snapshot as evidence. Clean up the processes you start; do NOT commit a permanent script unless it belongs alongside the other smoke scripts. Relevant client files: deck-loadout.js, deck-viewer.js, hand.js.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: visual`
