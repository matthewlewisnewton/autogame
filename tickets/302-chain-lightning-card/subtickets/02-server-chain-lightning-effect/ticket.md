# Server Chain Lightning effect and tests

Implement the `chain_lightning` spell combat logic: primary full-damage hit along the player's aim, then up to two chain bounces to the nearest not-yet-hit enemy within `chainRadius`, each dealing half the base damage. Wire the effect into `cardEffects.js` and add focused server tests.

## Acceptance Criteria

- A new exported helper `collectChainLightningHits` in `game/server/simulation.js` (or a dedicated small module required from simulation) applies damage in order:
  1. **Primary** — first enemy struck along the cast direction within `attackRange` (reuse `collectProjectileHits` with `pierces: false`, or equivalent first-target selection).
  2. **Chain 1** — nearest living enemy within `chainRadius` of the primary's position, not already hit, takes `round(baseDamage * 0.5)` damage.
  3. **Chain 2** — same rule from chain-1's position; also half base damage.
- The same enemy is never damaged twice in one cast.
- If fewer than three valid targets exist, only available enemies are hit (no error).
- `game/server/cardEffects.js` spell branch handles `cardDef.effect === 'chain_lightning'`: deducts MS cost, applies cooldown/consumption like other spells, calls the helper with grind-scaled damage, runs `cleanupAfterDamage`, and emits `SERVER_TO_CLIENT.CARD_USED` with `hits` (each entry includes `enemyId`, `hp`, and `damageDealt` or equivalent), `origin`, `direction`, `attackRange`, `chainRadius`, and `chainSegments` — an ordered array of `{ from: {x,z}, to: {x,z} }` world positions for client arc rendering (caster → primary → chain targets).
- New vitest coverage in `game/server/test/chain_lightning.test.js` (or an equivalent dedicated file) proves:
  - three-enemy layout: full + half + half damage amounts on three distinct `enemyId`s;
  - two-enemy layout: only two hits, no third;
  - one-enemy layout: only primary hit;
  - an enemy out of `chainRadius` is skipped even if it is nearest globally;
  - duplicate targeting is impossible when enemies overlap chain range.

## Technical Specs

- **`game/server/simulation.js`**:
  - Add `collectChainLightningHits(originX, originZ, dirX, dirZ, range, damage, options)` where `options` includes `chainRadius`, `maxChainTargets` (default 2), `attackerId`, and optional MS-on-hit/kill passthrough consistent with `collectProjectileHits`.
  - Chain loop mirrors the thunderbird minion logic in `updateMinions` (~2388–2411) but uses half-damage for chain steps and records each hit.
  - Export the helper from `module.exports`.
- **`game/server/cardEffects.js`**:
  - Add an `if (cardDef.effect === 'chain_lightning')` block in the spell branch (before the default radial AoE fallback ~767).
  - Use `resolveAttackRotation(player, data)` for aim; scale damage with `scaledGrindStat`.
  - Build `chainSegments` from caster origin and each struck enemy's `(x, z)` at hit time.
  - Set `specialEffect: 'chain_lightning'` on the emitted payload.
- **`game/server/index.js`**: re-export `collectChainLightningHits` if other modules/debug scenarios need it (follow existing `collectProjectileHits` pattern).
- **`game/server/test/chain_lightning.test.js`**: unit-test the helper with a minimal `gameState.enemies` fixture (same setup style as `new_card_pack.test.js`). Optionally add one integration-style `useCard` test if a lightweight harness exists nearby.
- Do **not** change client rendering in this sub-ticket.

## Verification: code
