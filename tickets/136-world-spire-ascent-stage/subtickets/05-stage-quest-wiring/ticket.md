# 05 — Quest and deploy wiring for Spire Ascent

Plumb the `spire-ascent` stage through quest selection and `applyLayoutForQuest` so a playtest quest deploys the tower layout end-to-end (spawn → ramps → top-tier treasure/objective).

## Acceptance Criteria

- At least one quest definition includes `layoutStage: 'spire-ascent'` (or equivalent field name consistent with `generateLayout` options).
- `applyLayoutForQuest` passes `{ stage: layoutStage, slopes: true }` (or stage-only if spire generator ignores `slopes`) when the quest specifies spire; default quests unchanged.
- `getLayoutProfileForQuest` / quest listing still works; new quest appears in `listQuests()` payload.
- Deploying the spire quest sets `state.layout.stage` to `spire-ascent`, `state.layoutSeed` deterministic from `questLayoutSeed`, and recomputes `dungeonBounds` / `walkableAABBs`.
- Spawn uses bottom `start` room; run objective / treasure marker targets top `treasure` room (existing role-based placement).
- Unit test: `applyLayoutForQuest` with spire quest id yields layout passing spire structural checks (tier count, top Y − spawn Y ≥ 10).

## Technical Specs

- **`game/server/quests.js`**: add quest e.g. `spire_ascent` with `layoutStage: 'spire-ascent'`, sensible `enemyCount` (≥ 5 to exercise sub-ticket 04), `layoutProfile: 'crowded'` or dedicated small profile.
- **`game/server/index.js`**: in `applyLayoutForQuest`, read `quest.layoutStage` and call `generateLayout(seed, profile, { stage: quest.layoutStage })`; omit redundant grid `slopes: true` when stage is spire-ascent.
- **`game/server/dungeon.js`**: ensure `generateLayout` dispatches on `options.stage` (from sub-ticket 03).
- **`game/server/test/server.test.js`** or **`dungeon.test.js`**: one integration test for `applyLayoutForQuest` + spire quest id.

## Verification: code
