# Frenzied variant registry entry

Add the `frenzied` enemy variant to the existing `VARIANT_DEFS` registry so combat
spawns can roll it through `applyVariant`, with the same bonus-drop shape as the
shipped `test` variant. This sub-ticket is registry and tests only — no combat-speed
logic yet.

## Acceptance Criteria

- `VARIANT_DEFS.frenzied` exists with `id: 'frenzied'`, a non-empty `name`, `apply:
  null` (spawn-time no-op), and a `bonusDrop` object (`card: true`, `magicStone`
  number) consumed by existing variant loot hooks.
- `applyVariant` can tag an enemy with `variant: 'frenzied'` when the roll selects
  it; untagged enemies still get `variant: null`.
- Selecting `frenzied` does not mutate combat stats at spawn (same guarantee as the
  `test` no-op variant).
- `game/server/test/enemy_variants.test.js` covers the new definition and tagging
  path; existing server + client tests pass.

## Technical Specs

- `game/server/enemyVariants.js`: add a `frenzied` entry beside `test` in
  `VARIANT_DEFS`. Keep `apply: null` until sub-ticket 02 owns runtime enrage.
  Reuse the `test` variant's `bonusDrop` magnitudes unless design calls for a
  different stone value (document the chosen value in the def).
- `game/server/test/enemy_variants.test.js`: assert the def shape, that
  `Object.keys(VARIANT_DEFS)` includes `frenzied`, and that a forced high-tier roll
  can produce `enemy.variant === 'frenzied'` with unchanged `hp` / `maxHp` vs a
  plain grunt spawn.
- No changes to `simulation.js` or `renderer.js` in this sub-ticket.

## Verification: code
