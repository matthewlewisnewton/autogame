# Add sloped-dungeon scenario to harness capture-plan prompt

The `sloped-dungeon` debug scenario exists in the server (`DEBUG_SCENARIOS`) but is not listed in the harness capture-plan prompt template. The LLM planner therefore cannot select it to frame a visible ramp for visual QA. Add the scenario to the prompt so future capture plans can use `{ slopes: true }` layouts.

## Acceptance Criteria
- `harness/prompts/capture-plan.md` lists `sloped-dungeon` under "Available development scenarios".
- The scenario description states that it regenerates the dungeon layout with slopes enabled for visual verification.
- No other scenarios are removed or renamed.

## Technical Specs
- **File**: `harness/prompts/capture-plan.md` — add `- sloped-dungeon: regenerate the dungeon layout with slopes enabled for visual verification of ramp geometry.` to the "Available development scenarios" list (currently lines ~29–35).
- Verify the scenario name matches the server's `DEBUG_SCENARIOS` set in `game/server/index.js` (line ~407: `'sloped-dungeon'`).

## Verification: code
