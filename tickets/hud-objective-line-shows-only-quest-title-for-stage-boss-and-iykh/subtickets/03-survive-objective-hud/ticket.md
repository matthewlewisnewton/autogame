# survive objective HUD goal and wave progress line

`survive` quests (e.g. Endless Siege) also lack a progress branch in `updateObjectiveHud()`, showing only the quest title. Extend the objective HUD formatter and wiring so survive runs display the wave goal and live defeat/spawn progress.

## Acceptance Criteria

- During a `playing` run with `run.objective.type === 'survive'`, `#objective-hud` shows the quest tier label plus a non-empty second line with the survive goal (derived from quest metadata or `objective.label`).
- The second line updates as progress changes: shows defeated count vs `objective.totalSpawns` (e.g. "Purged 3 / 10 hostiles" or theme-consistent copy), and reflects incremental changes to `objective.spawnedEnemies` while waves are still spawning.
- Existing HUD behavior for `stage_boss`, `escort`, `collect_items`, and `defeat_enemies` from prior sub-tickets remains intact.
- Unit tests cover survive formatter cases and an `updateObjectiveHud()` integration case.
- All five objective types (`collect_items`, `defeat_enemies`, `stage_boss`, `escort`, `survive`) now produce a non-empty goal/progress second line during `playing` runs.

## Technical Specs

- **Extend** `game/client/objectiveHud.js` — add `survive` handling inside `formatRunObjectiveHudLines({ run, questMeta })`:
  - **Goal portion**: `formatObjectiveSummary(questMeta)` or parse from `objective.label` (e.g. "Survive 10 hostiles (2 minibosses)").
  - **Progress portion**: use `objective.defeatedEnemies` and `objective.totalSpawns` (fall back to `objective.totalEnemies`) with copy aligned to the existing defeat_enemies HUD tone (`Purged X / Y hostiles`) or `THEME.objectives.surviveHostiles`-style phrasing; optionally prefix spawn progress when `spawnedEnemies < totalSpawns` (e.g. "Wave 4 / 10 spawned — 2 defeated").
- **Change** `game/client/main.js` — `updateObjectiveHud()`: add `else if (obj.type === 'survive')` branch delegating to `formatRunObjectiveHudLines`.
  - Optional cleanup: route `collect_items` and `defeat_enemies` through the same module for a single formatting path (behavior must stay identical).
- **Extend** `game/client/test/objectiveHud.test.js` with survive fixtures (mid-wave defeats, partial spawn).
- **Extend** `game/client/test/main.test.js` with a survive `stateUpdate` test (Endless Siege–style `totalSpawns` / `defeatedEnemies` payload).

## Verification: code
