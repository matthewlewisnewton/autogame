# Make the `open-plaza-stage` Debug Scenario Match a Real Plaza Deployment

The `open-plaza-stage` debug scenario currently swaps the layout to the
open-plaza arena **after** the generic `enterPlayingPhase(lobby)` call has
already run — and `enterPlayingPhase()` spawns enemies and starts the run against
the *previous* (default) layout and quest. The result is an end-state that does
NOT match what a normal `open_plaza_trial` deployment produces: the run,
enemies, and objective were built for the wrong layout. Reorder/rebuild the
scenario so its end-state is equivalent to selecting the `open_plaza_trial` quest
and deploying normally.

## Acceptance Criteria

- After triggering the `open-plaza-stage` debug scenario, the lobby's run,
  enemies, and objective are all built against the **open-plaza layout** (not the
  default rooms-and-passages layout): the active quest is `open_plaza_trial`
  (`state.selectedQuestId === 'open_plaza_trial'`) and `state.layout` is the
  open-plaza arena.
- Enemies and the objective present after the scenario are those produced for
  `open_plaza_trial` on the open-plaza layout — i.e. they exist on the plaza
  floor, consistent with normal deployment, not leftovers spawned against the old
  layout.
- Enemy / loot / objective positions are clear of cover (this scenario exercises
  the cover-aware placement from sub-ticket 05) and the player spawns on the
  plaza floor clear of cover.
- The player still ends in the `playing` phase with full HP / magic stones and a
  valid hand, as before.
- No regression to the other debug scenarios: the generic
  `player.ready/enterPlayingPhase` path and every other `name === ...` branch
  behave exactly as before.

## Technical Specs

- `game/server/index.js`, `applyDebugScenario()`: for `name ===
  'open-plaza-stage'`, ensure the open-plaza quest + layout are in place *before*
  the run/enemies are spawned, so the end-state matches normal deployment. Two
  acceptable approaches:
  1. **Select-then-deploy**: set `state.selectedQuestId = 'open_plaza_trial'` and
     build the open-plaza layout (`generateLayout(questLayoutSeed(
     'open_plaza_trial'), 'open-plaza', ...)`, plus `dungeonBounds`,
     `walkableAABBs`, `rebuildWallColliders()`) **before** the shared
     `enterPlayingPhase(lobby)` runs — e.g. handle this scenario's quest/layout
     setup ahead of the generic spawn block so `spawnEnemies()` sees the plaza
     layout and `open_plaza_trial` quest. Or
  2. **Swap-then-rebuild**: after swapping in the open-plaza layout (current
     code), set `state.selectedQuestId = 'open_plaza_trial'`, clear the
     enemies/objective spawned against the old layout, and re-run the normal
     run/enemy/objective setup (`spawnEnemies()` / the run-start path) against the
     new layout so the end-state equals a fresh deployment.
- Keep using `questLayoutSeed('open_plaza_trial')` for the seed and the existing
  `questUpdate` emit so clients receive the final layout.
- Make sure `syncRunObjectiveToEnemies()` (already called at the end of
  `applyDebugScenario`) reflects the rebuilt enemies/objective.
- Do not alter the shared `enterPlayingPhase()` behavior for other scenarios; if
  needed, add `'open-plaza-stage'` handling that runs its quest/layout setup in
  the correct order rather than changing the generic path.

## Verification: code
