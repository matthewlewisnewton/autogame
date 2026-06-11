# Frost Crossing tier 1: scripted kills must not satisfy stage_boss counter

Add a regression test for the reported repro on Frost Crossing tier 1: killing the first scripted dock grunt or ice-band Glacial Thrower must not move the stage-boss objective counter to `1/1` while the Permafrost Warden encounter is still dormant.

## Acceptance Criteria

- Deploy `frost_crossing` tier 1 via the real quest pipeline (`spawnEnemies` + `startDungeonRun`).
- After killing exactly one scripted non-boss hostile (first dock grunt from `room:0` wave `0`, or the first `band:ice` thrower after entering the ice room), `run.objective` matches `{ defeatedEnemies: 0, totalEnemies: 1, bossDefeated: false }`, `run.encounter.phase` is `'dormant'`, and `run.status` is `'playing'`.
- `isRunObjectiveComplete(run.objective)` is `false`.
- Existing `frost_crossing` stage-boss flow tests (`frost_crossing_stage_boss.test.js`, `frost_crossing_named_rare.test.js`) still pass, including victory only after the Permafrost Warden is defeated.
- Full harness vitest suite passes.

## Technical Specs

- **`game/server/test/frost_crossing_stage_boss.test.js`** (preferred home — already has `deployFrostCrossing`, `killScriptedWave`, and encounter helpers)
  - Add `it('does not increment stage_boss defeatedEnemies when a scripted dock grunt is killed', …)` using `killScriptedWave(state, 'room:0', 0)` with a single-grunt kill or equivalent, then assert objective and encounter state above.
  - Optionally add a second case for the first `band:ice` thrower wave after `enterRoom(state, iceRoom)` to mirror the Glacial Thrower repro from the parent ticket.
- No production-code changes expected if sub-ticket `01` landed correctly; this sub-ticket may only add/adjust tests. If the regression still fails, apply the minimal follow-up in `game/server/progression.js` or `game/server/objectives.js` needed to exclude `scriptedWave` enemies from the stage-boss counter.

## Verification: code
