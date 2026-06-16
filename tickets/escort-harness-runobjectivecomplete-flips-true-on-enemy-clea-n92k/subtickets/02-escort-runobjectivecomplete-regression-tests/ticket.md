# Client tests: escort runObjectiveComplete harness regression

Add vitest coverage in `game/client/test/main.test.js` so the escort harness instrumentation cannot regress to treating enemy-clear as run completion. Follow the existing `runObjectiveComplete is true only when stage_boss bossDefeated is true` test pattern (~L5166).

## Acceptance Criteria

- A new test asserts that after `__setGameState` with an escort run where `defeatedEnemies === totalEnemies`, `reachedDestination: false`, and `escort.atDestination: false`, `window.__AUTOGAME_HARNESS_STATE__().runObjectiveComplete` is **false** (reproduces the top-level ticket scenario).
- A new test asserts that with the same escort objective but `reachedDestination: true` (or `escort.atDestination: true`) and `escort.failed: false`, `runObjectiveComplete` is **true**.
- A new test asserts that with `escort.failed: true`, `runObjectiveComplete` is **false** even when destination flags are true.
- `pnpm test:quick` (or the client vitest subset) passes with the new tests and no regressions in existing `runObjectiveComplete` / harness-state tests.

## Technical Specs

- **`game/client/test/main.test.js`** — add one `describe` block or individual `it` cases adjacent to the existing stage_boss `runObjectiveComplete` test.
- Use `window.__setGameState({ gamePhase: 'playing', run: { status: 'playing', escort: { ... }, objective: { type: 'escort', totalEnemies, defeatedEnemies, reachedDestination } }, players: { p1: ... }, enemies: [] }, 'p1')` then read `window.__AUTOGAME_HARNESS_STATE__().runObjectiveComplete`.
- Cover at minimum: (1) all enemies cleared, not at destination → false; (2) at destination, not failed → true; (3) failed → false.
- No server or HUD changes required; this sub-ticket depends on sub-ticket 01's client logic fix.

## Verification: code
