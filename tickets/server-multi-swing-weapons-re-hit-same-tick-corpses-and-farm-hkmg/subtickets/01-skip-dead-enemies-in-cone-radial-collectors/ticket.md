# Skip dead enemies in cone/radial hit collectors

`collectConeHits` and `collectRadialHits` in `game/server/simulation.js` still damage enemies at `hp <= 0`, unlike `collectChainLightningHits` which skips them. Weapons with `swingsPerUse > 1` (e.g. Excalibur Photon) call these collectors once per swing in the same card-use tick, so a later swing re-hits the corpse and can farm `magicStoneOnHit` (and duplicate kill rewards) before `cleanupAfterDamage` removes the enemy. Add an early `enemy.hp <= 0` guard in both collectors and cover the multi-swing corpse re-hit case with a regression test.

## Acceptance Criteria

- `collectConeHits` skips any enemy with `hp <= 0` before applying damage or awarding `magicStoneOnHit` / kill rewards
- `collectRadialHits` skips any enemy with `hp <= 0` before applying damage or awarding `magicStoneOnHit` / heal rewards
- Simulating two cone swings that kill a single low-HP enemy grants `magicStoneOnHit` only once (not per swing on the corpse)
- Simulating two radial swings that kill a single low-HP enemy grants `magicStoneOnHit` only once
- Existing `collectConeHits` / `collectRadialHits` tests still pass

## Technical Specs

- **`game/server/simulation.js`**
  - In `collectConeHits` (~line 1705), inside the `for (const enemy of _gameState.enemies)` loop, add `if (enemy.hp <= 0) continue;` immediately after the loop opens (before range/cone checks), matching the guard in `collectChainLightningHits` (~line 1840).
  - In `collectRadialHits` (~line 1741), add the same `if (enemy.hp <= 0) continue;` guard at the top of its enemy loop (before the spherical distance check).
  - Do not change `cardEffects.js` — the `swingsPerUse` loop there is correct; the collectors must reject corpses on subsequent swings in the same tick.
- **`game/server/test/collect_hit_corpse_rehit.test.js`** (new file)
  - Import `createGameState`, `gameState`, `collectConeHits`, `collectRadialHits`, and `ATTACK_RANGE` from `../index.js`.
  - **Cone case:** place one enemy in cone range with `hp` equal to one swing's damage; call `collectConeHits` twice in a loop (mirroring `cardEffects.js` `swingsPerUse`) with `magicStoneOnHit: 5`; assert total `magicStonesGained` is `5`, second call returns zero hits, enemy ends at `hp <= 0`.
  - **Radial case:** place one enemy inside a small radial radius with `hp` equal to one swing's damage; call `collectRadialHits` twice with `magicStoneOnHit: 8`; assert total `magicStonesGained` is `8`, second call returns zero hits.
  - Use `beforeEach` to reset state via `Object.assign(gameState, createGameState())`, following `collect_cone_kill_rewards.test.js`.

## Verification: code
