# Add deterministic sloped-dungeon fallback capture recipe

When the LLM planner times out or produces an invalid recipe, the harness falls back to `fallbackRecipe()` — a generic lobby/movement smoke that never triggers `emitScenario` or captures a sloped room. For ticket 142, the fallback must include a sloped-dungeon scenario and a ramp screenshot to satisfy the top-level acceptance criterion.

## Acceptance Criteria
- `harness/screenshot.mjs` includes a mechanism to produce a sloped-dungeon capture when the LLM plan fails and the fallback is used.
- The fallback (or post-fallback enhancement) includes: full auth/lobby flow for two players → `waitForGame` → `emitScenario` `sloped-dungeon` → screenshot with description mentioning "sloped room" or "ramp".
- `metrics.json` `screenshots[]` contains at least one entry whose description references a sloped room or ramp when the fallback recipe is used for this ticket.
- The fallback still works for non-sloped tickets (does not break generic capture).

## Technical Specs
- **File**: `harness/screenshot.mjs`
  - Option A: Extend `fallbackRecipe()` to detect when the output directory path contains `sloped` or `142` and append `emitScenario` + ramp screenshot steps after the movement screenshots.
  - Option B: Add a `SLOPED_FALLBACK_RECIPE` constant and select it in the fallback-after-error path when `inferTicketFile()` resolves to a ticket mentioning "slope" or "ramp".
  - Option C (simplest): After the fallback recipe executes, check if `metrics.scenarios` is empty and the ticket file mentions "slope"/"ramp"/"sloped-dungeon"; if so, continue executing on the existing browser pages: `emitScenario('sloped-dungeon')` → wait → screenshot with ramp description.
  - The screenshot name should be `04-sloped-ramp` (or similar) with description: "Sloped dungeon room with ramp geometry visible after emitScenario sloped-dungeon."

## Verification: code
