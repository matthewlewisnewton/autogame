# Field Medic enemy AI (flee, ally heal, energy bead)

Implement server-side AI for `field_medic`: flee from nearby players, prioritize healing wounded allies on cooldown, and fire a weak ranged energy-bead attack when a player is within close range — without chasing. Add focused server tests and a debug scenario for manual inspection.

## Acceptance Criteria

- In `updateEnemies`, `field_medic` enemies take a dedicated branch **before** the default chase/wander logic:
  - **Flee**: when a living, non-concealed player is within `fleeRadius`, the medic moves away (kite/retreat) at `fleeSpeed`; it does not close to melee range or enter the standard chase state toward players.
  - **Ally heal**: when `healCooldownMs` has elapsed and a living ally enemy (not self, not players/minions) within `healRadius` has `hp < maxHp`, the medic heals the lowest-HP eligible ally by `healAmount` (capped at `maxHp`), records `lastHealAt`, and skips chasing that tick. Bosses and adds are valid heal targets.
  - **Energy bead**: when a player is within `beadRange` (close defense) and `beadCooldownMs` has elapsed, the medic fires a small ranged projectile at that player using `collectPhaseBeamHits` (or equivalent) with low `attackDamage`, `{ ranged: true, attackerEnemyId }`, and a short windup or instant resolution documented in code. It does not pursue players beyond bead range.
- Heal and bead behaviors respect encounter lock / frozen state the same way other enemies do.
- A debug scenario `field-medic` (registered in `DEBUG_SCENARIOS`) spawns one `field_medic`, one wounded `grunt` ally, and places the player near the medic for harness inspection.
- New server test file `game/server/test/field_medic.test.js` (preferred) with unit/integration cases that advance simulation ticks and assert:
  - medic position moves away from an approaching player;
  - ally `hp` increases after heal cooldown when ally is wounded;
  - player `hp` decreases after bead when in close range;
  - medic does not reduce distance to a distant player (no chase).
- Vitest passes.

## Technical Specs

- `game/server/simulation.js`:
  - Add helper(s) e.g. `updateFieldMedicEnemy(enemy, players, dt, now)` called from `updateEnemies` when `enemy.type === 'field_medic'`.
  - Reuse `moveEntityToward` with a retreat target (mirror ancient-wyrm retreat ~L1281–1284) for flee.
  - Reuse `collectPhaseBeamHits` for the energy bead (narrow `hitWidth`, range from def); queue client VFX payload on `_gameState` if needed (e.g. `_pendingMedicBeads` or reuse an existing pending-effects queue drained in `index.js`).
  - For ally heal VFX, push `{ medicId, targetId, x, z, healRadius }` records to a pending queue (e.g. `_pendingMedicHeals`) drained to clients each tick — mirror `_pendingLeechHeals` / volatile explosion patterns in `game/server/index.js`.
- `game/server/debugScenarios.js`:
  - Add `field-medic` branch: spawn wounded grunt + field_medic near player start.
- `game/server/index.js`:
  - Register `'field-medic'` in debug-scenario allowlists; drain pending medic heal/bead events to socket clients (event names documented in `shared/events.json` if new).
- `game/server/test/field_medic.test.js`:
  - Use `resetGameState`, `spawnEnemy`, `updateEnemies`, and direct player position mutation patterns from `server.test.js` / `integration.test.js`.
- Do **not** add client mesh/VFX in this sub-ticket (sub-ticket 04).

## Verification: code
