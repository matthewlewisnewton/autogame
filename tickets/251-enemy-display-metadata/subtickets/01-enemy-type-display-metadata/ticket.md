# Enemy type display metadata in ENEMY_DEFS

Add a human-readable `name`, one-line `description`, and `surfacedStats` array to every entry in `ENEMY_DEFS` (`grunt`, `skirmisher`, `miniboss`, `spawner`). Keep display fields on the definition only — do not copy them onto spawned enemy entities.

## Acceptance Criteria

- Every key in `ENEMY_DEFS` (`grunt`, `skirmisher`, `miniboss`, `spawner`) has:
  - `name`: non-empty string (player-facing display name, distinct from the internal `type` key).
  - `description`: non-empty one-line string summarizing role/behavior.
  - `surfacedStats`: non-empty array of strings naming which stat keys the lock-on info panel should show for this type (e.g. `'hp'`, `'attackDamage'`, `'attackStyle'`, `'spawnIntervalMs'`).
- Each `surfacedStats` entry is a key that exists on that type's `ENEMY_DEFS` entry (combat/stat fields only — not `name`/`description`/`surfacedStats`).
- `spawnEnemy` (`progression.js`) and `ensureEnemyCombatStats` (`simulation.js`) spread combat stats from the def but **omit** `name`, `description`, and `surfacedStats` so live enemy objects are not bloated with display metadata.
- Existing combat stat values on `ENEMY_DEFS` entries are unchanged.
- Vitest coverage asserts the metadata shape for all four types and confirms a spawned enemy does **not** carry `name`, `description`, or `surfacedStats`.
- Harness vitest suite passes.

## Technical Specs

- `game/server/simulation.js`:
  - Extend each `ENEMY_DEFS` entry with `name`, `description`, `surfacedStats`. Suggested display names (implementer may tune copy but must keep distinct, non-empty strings):
    - `grunt` → e.g. "Bulkhead Drone" — slow, durable radial attacker.
    - `skirmisher` → e.g. "Phase Stalker" — fast cone striker.
    - `miniboss` → e.g. "Vault Warden" — heavy cone boss with extended reach.
    - `spawner` → e.g. "Brood Node" — radial attacker that periodically summons skirmishers.
  - Pick `surfacedStats` per type from its existing stat keys (at minimum include `hp` and `attackDamage`; spawner should include spawn-related keys such as `spawnIntervalMs` and `spawnType`).
  - In `ensureEnemyCombatStats`, destructure display-only fields out before `Object.assign` (same keys as below).
- `game/server/progression.js` (`spawnEnemy` ~L2123):
  - Change `const { hp, ...statFieldsFromDef } = def` to also omit `name`, `description`, `surfacedStats` from the spread onto the enemy object.
- `game/server/test/server.test.js`:
  - Extend the existing `describe('ENEMY_DEFS')` block (~L4821) with cases for `name`, `description`, and `surfacedStats` on all four types.
  - Add a test that `spawnEnemy(0, 0, 'grunt')` returns an enemy without `name`, `description`, or `surfacedStats` properties.
- Do **not** change client code, `VARIANT_DEFS`, or combat behavior in this sub-ticket.

## Verification: code
