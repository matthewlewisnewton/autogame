# 02 — Magma Colossus enemy type

Add a new `magma_colossus` enemy type — the Ember Descent Tier II stage boss — to the server enemy catalog with fire-themed stats, loot mappings, and party-size HP scaling. This is the data layer that encounter wiring (04) and client render (03) build on.

## Acceptance Criteria

- `ENEMY_DEFS.magma_colossus` exists in `game/server/simulation.js` with `name: 'Magma Colossus'`, a fire-themed `description`, a `surfacedStats` array (e.g. `['hp', 'attackDamage', 'attackStyle', 'attackRange']`), and combat stats sized as a Tier-II stage boss (HP in the ~400–420 range — heavier than `cinder_warden` at 360, comparable to `spire_warden` at 420 — with a distinct attack profile such as `radial` molten shockwave or wide `cone`, plus attack damage, windup, and range).
- `game/server/config.js` includes `magma_colossus` in both `ENEMY_CARD_DROPS` (map to `dungeon_drake`, matching the other wardens) and `ENEMY_MS_DROPS` (a stage-boss magic-stone value, e.g. 52–55).
- `game/server/progression.js` adds `magma_colossus` to the boss-type list at the party-size HP-scaling branch (currently `resolvedType === 'miniboss' || ... === 'cinder_warden'`) so the colossus scales with party size like other stage bosses.
- The enemy display catalog (consumed by the lock-on info panel) includes `magma_colossus` with its name and surfaced stats — verify via `game/server/test/enemy_display_catalog.test.js`.
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/server/simulation.js`: add a `magma_colossus` entry to `ENEMY_DEFS`, mirroring the shape of `spire_warden` / `cinder_warden`. Fire flavor in name/description; stats tuned for Tier-II difficulty.
- `game/server/config.js`: add `magma_colossus` keys to `ENEMY_CARD_DROPS` and `ENEMY_MS_DROPS`.
- `game/server/progression.js`: extend the boss-type HP-scaling conditional to include `'magma_colossus'`.
- Add `game/server/test/magma_colossus.test.js` (modeled on `game/server/test/cinder_warden.test.js`) asserting the def fields, loot-map entries, and party-size HP scaling.
- Update `game/server/test/enemy_display_catalog.test.js` and any `ENEMY_DEFS` key-list tests that enumerate boss types.

## Verification: code
