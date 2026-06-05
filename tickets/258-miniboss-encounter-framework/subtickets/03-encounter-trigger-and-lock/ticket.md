# 03 — Encounter trigger and lock

Implement when a dormant stage-boss encounter becomes active and what “locking” means for the arena: the boss fight starts, non-boss threats are cleared or frozen, and ongoing spawn sources stop while the encounter is locked.

## Acceptance Criteria

- While `run.encounter.phase === 'dormant'`, the stage boss does not chase or attack players (idle/passive), and adds behave normally.
- `tryActivateEncounter(gameState)` (or equivalent) transitions to `active` + `locked: true` when **either** (a) every living enemy except the stage boss is defeated, **or** (b) any non-extracted player enters a configurable radius of `run.encounter.spawnAnchor` (default 8 world units, constant in `encounters.js` or `config.js`).
- On activation: `activateEncounter` + `lockEncounter` run; all non-boss enemies are removed from `gameState.enemies` (or marked dead and filtered on the same tick); spawner-type enemies stop producing adds while locked.
- While locked, `updateSurviveSpawns` / objective `tickSpawns` hooks no-op for that run, and spawner enemies in `simulation.js` do not emit adds when `isEncounterLocked(run)`.
- After activation the stage boss uses normal hostile AI (chase/attack) like any miniboss.
- Unit/integration tests cover both trigger paths (adds cleared vs. player proximity) and assert non-boss enemies are gone and spawner output is suppressed while locked.

## Technical Specs

- **`game/server/encounters.js`** — Add `tryActivateEncounter(gameState)` with trigger rules above; export `ENCOUNTER_TRIGGER_RADIUS`.
- **`game/server/progression.js`** or **`game/server/simulation.js`** — Call `tryActivateEncounter` once per simulation tick while `run.encounter?.phase === 'dormant'` and run is playing (pick the file that already owns the main dungeon tick / enemy update entry point).
- **`game/server/simulation.js`** — Early-return spawner add logic when `isEncounterLocked(_gameState.run)`.
- **`game/server/objectives.js`** — In `stage_boss` `tickSpawns` (if any) or document that survive ticks are irrelevant; ensure `updateSurviveSpawns` respects lock via shared helper.
- **`game/server/test/encounter_trigger_lock.test.js`** (new) — Harness with dormant boss + adds; assert trigger, enemy list, lock flag, and spawner suppression.
- Do not change victory rewards or quest catalog entries in this sub-ticket.

## Verification: code
