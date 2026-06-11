## Harness fallback does not verify 3s standstill HP for Initiate Vault

The generic fallback screenshot recipe probes immediately after `waitForGame` and then holds W/D. It never waits 3 seconds idle or asserts HP at deploy. A ticket-specific capture step (or agent-guided plan) that deploys Initiate Vault tier 1, waits 3000 ms with no input, and probes `hp === 100` would catch future regressions in browser runs without relying on vitest alone.
### Acceptance Criteria
- Capture plan for this quest includes a post-deploy 3000 ms idle wait before the first gameplay probe.
- Probe asserts player HP is 100/100 (or documents expected persisted-HP baseline separately).

## Spawn-camp regression test uses layout seed 1, not quest layout seed

`training_caverns_spawn_camp.test.js` uses `SEED = 1` while live Initiate Vault tier 1 uses `questLayoutSeed('training_caverns', 1)` (352369970 in capture). Bulkhead placement is geometry-dependent; running the grace test against the canonical quest seed would better match production layout.
### Acceptance Criteria
- `training_caverns_spawn_camp.test.js` deploys with `questLayoutSeed(QUEST_ID, 1)` (or the same helper as `training_caverns_named_rare.test.js`).
- Test still passes and entry grunts remain outside attack range at spawn.

## tier1_quest_identity does not assert aggroGraceMs on entry wave

`tier1_quest_identity.test.js` was updated for `towardPassage` spawn entries but does not check `aggroGraceMs: 3000` on room-0 wave-0. A one-line expectation would guard against accidental removal during quest-data edits.
### Acceptance Criteria
- `tier1_quest_identity` expects `startRoom.waves[0].aggroGraceMs === 3000` for `training_caverns` tier 1.
