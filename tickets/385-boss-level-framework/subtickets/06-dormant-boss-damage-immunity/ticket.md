# Dormant encounter boss damage immunity

Prevent the encounter boss (`run.encounter.bossEnemyId`) from taking damage while `run.encounter.phase === 'dormant'`, so premature boss kills cannot softlock `stage_boss` victory (especially on compact boss levels with live supports such as `vault_onslaught`).

## Acceptance Criteria

- A shared server helper (e.g. `canDamageEnemy(gameState, enemy)` or `isDormantEncounterBoss(gameState, enemy)` in `encounters.js`) returns false for the wired encounter boss while the encounter is dormant.
- `damageEnemy()` in `simulation.js` early-returns with `{ killed: false }` and leaves HP unchanged when the helper blocks damage; all combat paths that call `damageEnemy` inherit the guard (direct weapon hits, radial/AoE, burn/tick, spike traps, minion attacks).
- After encounter activation (`phase: 'active'`), the same boss can be damaged and defeated normally; `onStageBossDefeated` clears the encounter and completes the `stage_boss` objective.
- New tests cover dormant immunity for: (1) direct `damageEnemy` call, (2) at least one AoE/radial path, (3) burn/trap tick damage, and (4) minion damage — using a boss-level fixture or `vault_onslaught`-style deploy with `addCount > 0`.
- Regression: existing `encounter_trigger_lock.test.js` and boss-level defeat tests still pass; dormant boss HP is unchanged after simulated combat while supports remain.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/encounters.js`** — Add `canDamageEnemy(gameState, enemy)` (or equivalent) that checks `enemy.id === run.encounter.bossEnemyId && isEncounterDormant(run)`; export it.
- **`game/server/simulation.js`** — At the top of `damageEnemy()`, consult the new helper via `_gameState` (or pass `gameState` if already available at call sites) and no-op when blocked.
- **`game/server/progression.js`** — No behavioral change expected beyond safer `removeDeadEnemies` / `onStageBossDefeated` wiring; confirm dormant boss never reaches `hp <= 0` through combat.
- **`game/server/test/dormant_boss_damage.test.js`** (new) — Deploy a dormant encounter (boss-level fixture or `vault_onslaught`), assert boss HP unchanged across direct, AoE, burn/trap, and minion damage while dormant; assert damage applies after `tryActivateEncounter`; assert boss defeat still completes the objective when active.
- **`game/server/test/encounter_trigger_lock.test.js`** or **`game/server/test/boss_level_reuse.test.js`** — Add or extend a case that AoE/burn cannot kill a dormant boss before activation.

## Verification: code
