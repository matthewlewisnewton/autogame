# 177-qa-card-evolution-trigger

## Difficulty: medium

## Goal

Play until a card EVOLUTION triggers (e.g. the undead-commander/evo line) and verify the evolved card/creature replaces the base form with its upgraded stats/behavior. QA playthrough ticket: drive the real game in a headless browser (playwright) and confirm the feature fires. Use ISOLATED high ports so live runs are untouched (e.g. server PORT=32xx, vite --port 52xx --strictPort with HARNESS_GAME_PORT matching). Server needs ALLOW_DEBUG_SCENARIOS=1 for debug helpers. Reuse the existing flow from game/client/scripts/*.mjs: POST /api/register, inject token into localStorage('autogame_token'), create lobby, ready, wait for phase 'playing', then use window.__requestDebugScenarioForTest(...) and window.__AUTOGAME_HARNESS_STATE__() to reach and inspect state. Capture screenshots + a state snapshot as evidence. Clean up the processes you start; do NOT commit a permanent script unless it belongs alongside the other smoke scripts. Use a debug scenario to set up the precondition if one exists.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: visual`
