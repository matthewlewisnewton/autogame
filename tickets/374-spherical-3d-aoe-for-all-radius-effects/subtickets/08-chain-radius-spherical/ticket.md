# 08-chain-radius-spherical

Chain lightning hop selection still falls back to flat XZ distance whenever the initial shot is level (`dirY === 0`): both the player card path in `collectChainLightningHits` and the Thunderbird minion chain loop gate the 3D distance behind `use3D`. Chain hops must always be 3D spherical from the last hit target, regardless of the firing direction's vertical component.

## Acceptance Criteria

- In `collectChainLightningHits`, the chain hop distance from `currentPos` to each candidate enemy is ALWAYS computed as 3D (`Math.hypot(dx, dy, dz)` using `getEntityWorldY(enemy)` and `currentPos.y`), with no `use3D`/`dirY` gating. The `use3D` flag may still gate the primary ray sampling — only chain hop selection changes.
- In the Thunderbird minion chain loop in the minion update, the hop distance from the current target to each candidate enemy is ALWAYS 3D, with no `use3D` gating.
- With a flat (dirY = 0) chain lightning cast: an elevated enemy whose 3D distance from the first hit target is ≤ `chainRadius` IS chained to; an enemy XZ-inside `chainRadius` but whose height difference pushes its 3D distance over `chainRadius` is NOT chained to.
- The same two height cases pass for the Thunderbird minion's chain.
- Chain ordering still picks the nearest eligible enemy by (now 3D) distance, and `maxChainTargets`/damage halving behavior is unchanged.
- Updated tests in `game/server/test/chain_lightning.test.js` (player card) and `game/server/test/new_card_pack.test.js` (Thunderbird) cover the elevated in-sphere chain and XZ-inside/out-of-sphere exclusion cases with a level cast.
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/server/simulation.js`:
  - `collectChainLightningHits` (~lines 1570–1573): replace the `use3D ? 3D : 2D` ternary with the unconditional 3D form `Math.hypot(enemy.x - currentPos.x, enemyY - currentPos.y, enemy.z - currentPos.z)`. `currentPos.y` is already populated by `recordHit` via `getEntityWorldY`.
  - Thunderbird chain loop (~lines 3168–3172): replace the `use3D` ternary with the unconditional 3D form using `getEntityWorldY(enemy)` and `getEntityWorldY(current)`.
- `game/server/test/chain_lightning.test.js`: add a level-cast scenario with the second enemy elevated but inside `chainRadius` (expect chained) and a third XZ-near but vertically out-of-sphere (expect not chained). Setting `enemy.y` directly is sufficient.
- `game/server/test/new_card_pack.test.js`: mirror the same two height cases for the Thunderbird minion chain.

## Verification: code
