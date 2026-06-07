# Fire enemy definition and display metadata

Add a new `ember_wraith` enemy type to `ENEMY_DEFS` as the fire-level signature foe: a fast cone striker tuned to ignite players (via a `burnDurationMs` field used by a later sub-ticket). Include the display metadata required by the lock-on info panel (tickets 251/252). No spawn wiring, attack burning logic, or client visuals in this sub-ticket.

## Acceptance Criteria

- `ENEMY_DEFS.ember_wraith` exists in `simulation.js` with:
  - `name`: non-empty player-facing string (e.g. "Ember Wraith").
  - `description`: non-empty one-line summary mentioning igniting / burning the player on hit.
  - `surfacedStats`: non-empty array of keys that exist on the def (at minimum `hp`, `attackDamage`, `attackStyle`, `chaseSpeed`, and `burnDurationMs`).
  - Combat stats appropriate for a fire-level skirmisher (~45–70 HP, moderate `attackDamage` ~6–10, `attackStyle: 'cone'`, `burnDurationMs` ~2000–3500 for a short burn).
- `enemyDefFor('ember_wraith')` resolves without error; `spawnEnemy` creates a living enemy with combat stats spread from the def but **without** `name`, `description`, or `surfacedStats` on the instance.
- `buildEnemyDisplayCatalog()` includes `ember_wraith` with trimmed display fields (name, description, surfaced stats and their values).
- Existing enemy types' combat values are unchanged.
- Vitest passes.

## Technical Specs

- `game/server/simulation.js`:
  - Add `ember_wraith` to `ENEMY_DEFS` after `field_medic`. Suggested identity: warm orange/red cone striker that sets players ablaze. Include `attackConeAngle` consistent with other cone enemies (e.g. `Math.PI / 3`).
  - Do **not** change `updateEnemies` strike logic or quest pools yet.
- `game/server/test/enemy_display_catalog.test.js`:
  - Add `'ember_wraith'` to `ENEMY_TYPES` and assert catalog entry matches def.
- `game/server/test/server.test.js` (or a small dedicated test file):
  - Assert `ENEMY_DEFS.ember_wraith` metadata shape and `burnDurationMs > 0`.
  - Assert `spawnEnemy(0, 0, 'ember_wraith')` omits display-only fields and copies `burnDurationMs`.
- Update any hard-coded `ENEMY_DEFS` key lists in server tests that enumerate all types to include `ember_wraith`.
- Do **not** add `ember_wraith` to quest pools, client `ENEMY_GEOMETRY`, or burning-on-hit logic in this sub-ticket.

## Verification: code
