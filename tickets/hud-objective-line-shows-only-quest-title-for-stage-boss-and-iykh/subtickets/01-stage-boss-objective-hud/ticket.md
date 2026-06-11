# stage_boss objective HUD goal and progress line

`updateObjectiveHud()` in `main.js` only formats progress for `collect_items` and `defeat_enemies`, so stage-boss runs (e.g. Frost Crossing) show only the quest title with no goal line. Add a client formatter module and wire `stage_boss` so the HUD shows the boss goal (e.g. "Defeat the Permafrost Warden") plus live sub-progress that updates during the run.

## Acceptance Criteria

- During a `playing` run with `run.objective.type === 'stage_boss'`, `#objective-hud` displays the quest tier label on the first line and a non-empty second line with the boss goal text derived from quest metadata (Frost Crossing tier 1 must include "Defeat the Permafrost Warden").
- The second line updates as run progress changes: scripted-route wave clearance counts when `run.scriptedEncounter` is present, and/or encounter support kill counts via `objective.defeatedEnemies` / `objective.totalEnemies` when adds exist; when the boss is defeated (`objective.bossDefeated` or `run.encounter.phase === 'cleared'`), progress reflects completion.
- Existing `collect_items` and `defeat_enemies` HUD behavior is unchanged.
- Unit tests cover the pure formatter and an `updateObjectiveHud()` integration case for `stage_boss`.

## Technical Specs

- **Add** `game/client/objectiveHud.js` exporting `formatRunObjectiveHudLines({ run, questMeta })` (initially handling `stage_boss` only; other types return empty progress so later sub-tickets can extend the same module).
  - Resolve quest metadata with `formatObjectiveSummary` from `questBoard.js`, merging `run.questId`, `run.encounter`, and fields from the `questMeta` argument (`findQuestBoardEntry` result).
  - **Goal line** (second HUD line base): output of `formatObjectiveSummary` for the resolved quest (e.g. "Defeat the Permafrost Warden").
  - **Progress suffix** (appended or combined on the second line): when `run.scriptedEncounter.rooms` exists, count cleared waves vs total authored waves across room entries; when `objective.addCount > 0` or `objective.totalEnemies > 1`, show support clearance as `Supports cleared X / Y`; when `objective.bossDefeated` or encounter phase is `cleared`, show a completion phrase (e.g. "Warden defeated"). Prefer `THEME.objectives` strings where they already exist; add minimal new keys to `game/shared/theme.json` only if needed.
- **Change** `game/client/main.js` — `updateObjectiveHud()`:
  - Look up `questMeta` via `findQuestBoardEntry(run.questId, run.questTier, quests, questVariants)`.
  - For `stage_boss`, call `formatRunObjectiveHudLines` and set `textContent` to `title + '\n' + goal/progress` (same two-line pattern as existing types).
- **Add** `game/client/test/objectiveHud.test.js` with pure-function cases for frost_crossing tier 1, a stage_boss with adds, and scriptedEncounter wave progress.
- **Extend** `game/client/test/main.test.js` `describe('updateObjectiveHud()')` with a `stage_boss` stateUpdate fixture asserting the HUD contains the boss goal and progress text.

## Verification: code
