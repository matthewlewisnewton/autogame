# Objective HUD branches on objective type

`updateObjectiveHud()` in `game/client/main.js` hardcodes a defeat-enemies progress line (`Purged ${defeatedEnemies} / ${totalEnemies} hostiles`) for every run objective. Collect-items quests therefore show `Purged undefined/undefined hostiles` because they use `collectedItems` / `totalItems` instead. Branch on `obj.type` and reuse the same theme strings as the suspended-run banner and quest board.

## Acceptance Criteria

- During a `playing` run with a `collect_items` objective, `#objective-hud` shows prism progress (e.g. `2/5 prisms`) and does **not** contain the word `hostiles` or `undefined`.
- During a `playing` run with a `defeat_enemies` objective, `#objective-hud` still shows hostiles progress (e.g. `Purged 1 / 5 hostiles` or equivalent using `defeatedEnemies` / `totalEnemies`).
- When not in a `playing` run (or when `run.objective` is absent), `#objective-hud` stays hidden.
- A vitest in `game/client/test/main.test.js` asserts the HUD text for at least one `collect_items` and one `defeat_enemies` objective via `stateUpdate` (or equivalent harness hook).
- `pnpm test:quick` passes.

## Technical Specs

- **`game/client/main.js`** — update `updateObjectiveHud()` (~line 2294):
  - Read `obj.type` from `run.objective`.
  - For `collect_items`: build the progress line with `THEME.objectives.collectPrismsProgress`, substituting `collectedItems` and `totalItems` (mirror `renderSuspendedRunBanner()` ~lines 590–593).
  - For `defeat_enemies`: keep the existing hostiles line using `defeatedEnemies` / `totalEnemies`.
  - For other types (`survive`, etc.): either omit the progress line or add a sensible type-specific line; do not read defeat-enemy fields on non-defeat objectives.
  - Keep the quest title line via `formatQuestTierLabel(run.questName, run.questTier ?? 1)`.
- **`game/client/test/main.test.js`** — add a `describe('updateObjectiveHud()')` (or extend an existing playing-phase HUD block):
  - Import `main.js`, set up required DOM ids including `objective-hud`.
  - Fire `stateUpdate` with `gamePhase: 'playing'`, `run.questName`, and `run.objective` typed as `collect_items` with `collectedItems` / `totalItems`; assert `#objective-hud.textContent`.
  - Repeat for `defeat_enemies` with `defeatedEnemies` / `totalEnemies`.

## Verification: code
