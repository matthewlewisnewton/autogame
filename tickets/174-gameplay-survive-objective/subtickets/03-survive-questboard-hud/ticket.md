# Survive objective summary on the lobby quest board

Add a `survive` case to the quest-board objective summary so the lobby quest
card describes a survive contract (total spawns and minibosses) instead of
falling back to the bare description. Depends on sub-ticket 01.

## Acceptance Criteria

- `formatObjectiveSummary(quest)` in `game/client/questBoard.js` returns a
  survive-specific summary string when `quest.objectiveType === 'survive'`,
  incorporating `quest.totalSpawns` and `quest.minibossCount` (e.g. "Survive 10
  hostiles (2 minibosses)").
- The summary is sourced from a new `THEME.objectives.*` template string in
  `game/shared/theme.json` (mirroring the existing `recoverPrisms` /
  `neutralizeHostiles` templates with `{count}` / placeholder substitution), not
  a hard-coded literal in `questBoard.js`.
- The existing `collect_items` and `defeat_enemies` branches and the default
  fallback are unchanged in behavior.
- A `survive` quest rendered via `renderQuestBoard(...)` shows this summary in
  its `.quest-objective` element.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/shared/theme.json`: add a template under the `objectives` block (e.g.
  `"surviveHostiles": "Survive {count} hostiles ({minibosses} minibosses)"`).
  Keep the client `theme.js` in sync if it embeds/derives these strings.
- `game/client/questBoard.js`: in `formatObjectiveSummary` (~7), add a branch
  for `quest.objectiveType === 'survive'` that fills the new template with
  `quest.totalSpawns` and `quest.minibossCount` via `String(...).replace(...)`,
  matching the style of the existing branches at lines 10 and 15.
- Add/extend a unit test for `formatObjectiveSummary` covering the `survive`
  case if such tests exist for the quest board helpers.

## Verification: code
