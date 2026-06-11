# escort objective HUD goal and ambush progress line

Escort runs (e.g. Annex Evacuation) show only the quest title in `#objective-hud` because `updateObjectiveHud()` has no `escort` branch. Extend the objective HUD formatter and wiring so escort quests display the escort goal and live ambush clearance progress for the entire run.

## Acceptance Criteria

- During a `playing` run with `run.objective.type === 'escort'`, `#objective-hud` shows the quest tier label plus a non-empty second line containing the escort NPC name (Annex Evacuation tier 1 must reference "Archivist Vale").
- The second line includes live ambush progress in the form `ambush X / Y cleared` (or equivalent readable copy) using `objective.defeatedEnemies` and `objective.totalEnemies`, and updates when kills change.
- When the escort reaches the destination (`run.escort.atDestination` or `objective.reachedDestination`), the progress line reflects arrival (e.g. destination reached or en route to extract).
- When `run.escort.failed` is true, the HUD shows the failure state instead of normal ambush progress.
- Existing `stage_boss`, `collect_items`, and `defeat_enemies` HUD behavior from sub-ticket 01 remains intact.
- Unit tests cover escort formatter cases and an `updateObjectiveHud()` integration case.

## Technical Specs

- **Extend** `game/client/objectiveHud.js` — add `escort` handling inside `formatRunObjectiveHudLines({ run, questMeta })`:
  - **Goal portion**: prefer `formatObjectiveSummary(questMeta)` (e.g. "Escort Archivist Vale to treasure"); fall back to `Escort ${run.escort?.npcName || 'VIP'}` when quest board metadata is unavailable.
  - **Progress portion**: `ambush ${defeatedEnemies} / ${totalEnemies} cleared` while ambushes remain; append destination status when `run.escort.atDestination` or `objective.reachedDestination`; on `run.escort.failed` or `objective.escortFailed`, surface `run.objective.label` or a short failure phrase.
- **Change** `game/client/main.js` — `updateObjectiveHud()`: add `else if (obj.type === 'escort')` branch delegating to `formatRunObjectiveHudLines` (same two-line `title\nprogress` layout).
- **Extend** `game/client/test/objectiveHud.test.js` with escort fixtures (partial ambush, destination reached, failed escort).
- **Extend** `game/client/test/main.test.js` with an escort `stateUpdate` test using `annex_escort`-style payload (`run.escort.npcName`, `objective.defeatedEnemies` / `totalEnemies`).

## Verification: code
