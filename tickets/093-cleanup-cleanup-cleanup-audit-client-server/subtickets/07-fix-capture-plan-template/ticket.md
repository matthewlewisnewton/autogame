# Add missing debug scenarios to capture-plan template

Round-5 capture used `summon-ready` instead of `monster-card` because `harness/prompts/capture-plan.md` only lists three scenarios (`summon-low-mana`, `summon-ready`, `combat-damaged-player`). The server has five registered debug scenarios in `DEBUG_SCENARIOS` — the missing `monster-card`, `mixed-enemies`, and `spawner-active` are invisible to Gemini when it generates capture plans, so it defaults to a known scenario that doesn't exercise the ticket's target behavior.

## Acceptance Criteria

- `harness/prompts/capture-plan.md` lists **all five** registered debug scenarios: `summon-low-mana`, `summon-ready`, `combat-damaged-player`, `mixed-enemies`, `spawner-active`, `monster-card`.
- The scenario list in the template matches the `DEBUG_SCENARIOS` set in `game/server/index.js` (no extra, no missing entries).
- The template includes a one-line description for each scenario so Gemini can select the right one.

## Technical Specs

- **File:** `harness/prompts/capture-plan.md` — update the "Available development scenarios" section to include all scenarios from `DEBUG_SCENARIOS` in `game/server/index.js` (line ~297).
- **File:** `game/server/index.js` — read `DEBUG_SCENARIOS` to get the authoritative list; do not modify this file.

## Verification: code
