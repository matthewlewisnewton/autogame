# Warded variant registry and spawn-time shield

Add the `warded` enemy variant to `VARIANT_DEFS` with an `apply` hook that grants a
damage-absorbing shield on spawn, reusing the same `shieldHp` / `maxShieldHp` field
names already used for player shields in `simulation.js`. This wires the affix into
the existing `applyVariant` seam from ticket 169 without yet changing damage math.

## Acceptance Criteria

- `VARIANT_DEFS.warded` exists with `id: 'warded'`, a display `name`, a function
  `apply`, and a `bonusDrop` entry consistent with other variants.
- When `applyVariant` selects `warded`, the enemy has `variant: 'warded'`,
  `shieldHp > 0`, `maxShieldHp === shieldHp`, and base `hp` / `maxHp` unchanged.
- Enemies without the warded tag have no `shieldHp` (or `shieldHp === 0`).
- A deterministic server unit test forces the warded tag via `applyVariant` and
  asserts shield fields; existing server tests still pass.

## Technical Specs

- `game/server/enemyVariants.js`:
  - Register `warded` beside `test` in `VARIANT_DEFS`.
  - `apply(enemy)`: set `maxShieldHp` to a defined constant (e.g. `40`, or
    `Math.max(20, Math.round((enemy.maxHp || enemy.hp) * 0.4))`) and
    `shieldHp = maxShieldHp`. Do not modify `hp` / `maxHp`.
  - Add `bonusDrop` (e.g. `{ card: true, magicStone: 20 }`) so variant loot hooks
    keep working.
- `game/server/test/warded_variant.test.js` (new): import `applyVariant`,
  `VARIANT_DEFS`, build a grunt-shaped enemy stub, drive `applyVariant(enemy, 1,
  seqRng)` so `warded` is selected (or call `VARIANT_DEFS.warded.apply` directly
  after setting `enemy.variant = 'warded'`), assert shield fields and unchanged HP.
- No changes to damage paths yet — shield is inert until sub-ticket 02.

## Verification: code
