## Add server test for `collect-prisms-progress` debug scenario

The new `collect-prisms-progress` scenario follows the same QA-shortcut pattern as `quest-objective-near-complete`, but unlike that scenario it has no entry in `game/server/test/debug-scenarios.test.js`. A small integration test would lock in the `crystal_rescue` / `collect_items` run shape and partial `collectedItems` patch.

### Acceptance Criteria

- `debugScenario` with name `collect-prisms-progress` returns `{ ok: true }` on localhost.
- Resulting `run.objective.type` is `collect_items` with `0 < collectedItems < totalItems`.

## Survive objective HUD shows title only

`updateObjectiveHud()` now correctly omits enemy fields for non-defeat objectives, but `survive` runs show only the quest title with no time/wave progress. This is not a regression (the old code would have shown `undefined` hostiles), but a dedicated survive progress line would improve consistency with collect/defeat HUDs.

### Acceptance Criteria

- During a `playing` run with `objective.type === 'survive'`, `#objective-hud` shows a meaningful progress indicator (e.g. elapsed time or wave count) derived from objective state.
- Vitest asserts the survive progress text and absence of `undefined`.
