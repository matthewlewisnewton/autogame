# Define the Cinder Warden boss enemy type

Add a new `cinder_warden` enemy type — the FIRE level-1 stage boss — to the
server enemy catalog with fire-flavored stats, loot mappings, and party-size HP
scaling. This is the data layer that the encounter wiring (02) and client render
(03) build on; it also makes the boss appear in the enemy display catalog that
drives the lock-on metadata panel.

## Acceptance Criteria
- `ENEMY_VARIANTS.cinder_warden` exists in `game/server/simulation.js` with
  `name: 'Cinder Warden'`, a fire-themed `description`, a `surfacedStats` array
  (e.g. `['hp', 'attackDamage', 'attackStyle', 'attackRange']`), and combat
  stats sized as a level-1 stage boss (HP in the ~340–380 range — heavier than
  the generic `miniboss` at 300, lighter than `spire_warden`/`arena_champion`
  at 420 — with a `cone` or `radial` attack, attack damage, windup, and range).
- `game/server/config.js` includes `cinder_warden` in both `ENEMY_CARD_DROPS`
  (map to `dungeon_drake`, matching the other wardens) and `ENEMY_MS_DROPS`
  (a stage-boss magic-stone value, e.g. 50–55).
- `game/server/progression.js` adds `cinder_warden` to the boss-type list at the
  party-size HP-scaling branch (currently
  `resolvedType === 'miniboss' || ... === 'spire_warden'`) so the warden scales
  with party size like other stage bosses.
- The enemy display catalog (consumed by the lock-on info panel) includes
  `cinder_warden` with its name and surfaced stats — verify via the existing
  catalog test path (`game/server/test/enemy_display_catalog.test.js`).
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs
- `game/server/simulation.js`: add a `cinder_warden` entry to the
  `ENEMY_VARIANTS` map, mirroring the shape of the `spire_warden` / `miniboss`
  entries. Fire flavor in name/description.
- `game/server/config.js`: add `cinder_warden` keys to `ENEMY_CARD_DROPS` and
  `ENEMY_MS_DROPS`.
- `game/server/progression.js`: extend the `resolvedType === 'miniboss' || ...`
  conditional (around the `DIFFICULTY_MINIBOSS_HP_PER_PLAYER` scaling block) to
  include `'cinder_warden'`.
- Add/extend a server test (e.g. a new `game/server/test/cinder_warden.test.js`)
  asserting the variant def fields, the loot-map entries, and that HP scales with
  party size.

## Verification: code
