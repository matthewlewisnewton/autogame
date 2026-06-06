# Field Medic enemy definition and display metadata

Add a new `field_medic` enemy type to `ENEMY_DEFS` with combat tuning appropriate for a fragile support unit (low HP, weak damage, flee/heal/bead parameters used by later sub-tickets) plus the display metadata required by the lock-on info panel (tickets 251/252). No spawn wiring or AI in this sub-ticket.

## Acceptance Criteria

- `ENEMY_DEFS.field_medic` exists in `simulation.js` with:
  - `name`: non-empty player-facing string (e.g. "Field Medic").
  - `description`: non-empty one-line summary of flee/heal/defensive-bead behavior.
  - `surfacedStats`: non-empty array of keys that exist on the def (at minimum `hp`, `attackDamage`; include medic-specific keys such as `healAmount` / `healCooldownMs` / `fleeSpeed` if defined).
  - Combat stats: modest HP (~50–80), low `attackDamage` (~4–8), documented medic tuning fields (`fleeSpeed`, `fleeRadius`, `healAmount`, `healRadius`, `healCooldownMs`, `beadRange`, `beadCooldownMs` or equivalent names) that later AI will read.
- `enemyDefFor('field_medic')` resolves without error; `spawnEnemy` creates a living enemy with combat stats spread from the def but **without** `name`, `description`, or `surfacedStats` on the instance.
- `buildEnemyDisplayCatalog()` includes `field_medic` with trimmed display fields; lock-on panel model builder can resolve the type (covered by catalog / panel unit tests).
- Existing enemy types' combat values are unchanged.
- Vitest passes.

## Technical Specs

- `game/server/simulation.js`:
  - Add `field_medic` to `ENEMY_DEFS` after `spawner`. Suggested identity: green/teal support drone that kites players and heals allies (copy may be tuned). Include `attackStyle: 'projectile'` (or a dedicated string documented in the def) for the bead attack path in sub-ticket 03.
  - No changes to `updateEnemies` yet.
- `game/server/test/enemy_display_catalog.test.js`:
  - Add `'field_medic'` to `ENEMY_TYPES` and assert catalog entry matches def.
- `game/server/test/server.test.js` (or a small dedicated test file):
  - Assert `ENEMY_DEFS.field_medic` metadata shape.
  - Assert `spawnEnemy(0, 0, 'field_medic')` omits display-only fields.
- Update any hard-coded `ENEMY_DEFS` key lists in server tests that enumerate all types (e.g. `describe('ENEMY_DEFS')` blocks) to include `field_medic`.
- Do **not** add `field_medic` to quest pools, client `ENEMY_GEOMETRY`, or AI logic in this sub-ticket.

## Verification: code
