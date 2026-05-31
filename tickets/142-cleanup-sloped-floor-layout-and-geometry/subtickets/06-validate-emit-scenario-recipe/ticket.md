# Validate emitScenario recipes and auto-inject missing auth/lobby steps

Round-1 Gemini plan included `emitScenario` / `waitForGame` but omitted `registerUser`, `loginUser`, `createLobby`, and `joinLobby`, causing a 12s timeout and fallback smoke. The capture-plan prompt documents the correct flow but the planner ignored it. Add a pre-execute validator that detects this pattern and auto-injects the standard auth/lobby prefix.

## Acceptance Criteria
- `harness/screenshot.mjs` `validateRecipe()` (or a post-validate hook) detects when a recipe contains `emitScenario` or `waitForGame` without preceding `registerUser`, `loginUser`, `createLobby` (for player A), and `joinLobby` (for player B).
- When the pattern is detected, the validator either fails fast with a clear error message OR automatically prepends the missing auth/lobby steps from the fallback recipe.
- Recipes that already contain the full auth/lobby flow are not modified.
- Recipes that do not use `emitScenario` or `waitForGame` are unaffected.

## Technical Specs
- **File**: `harness/screenshot.mjs`
  - After `validateRecipe()` returns (or inside it), add a check: scan `recipe.steps` for `emitScenario` or `waitForGame`. If found, verify that steps before them include `registerUser`, `loginUser`, `createLobby`, and (if two players) `joinLobby`.
  - If steps are missing, prepend the standard auth/lobby prefix: `connectPlayer A` → `registerUser A` → `loginUser A` → `createLobby A` → `connectPlayer B` → `registerUser B` → `loginUser B` → `joinLobby B`. Log `[validateRecipe] auto-injected auth/lobby prefix for emitScenario`.
  - Alternatively, throw a validation error with a message like "emitScenario requires preceding registerUser, loginUser, createLobby, joinLobby steps".

## Verification: code
