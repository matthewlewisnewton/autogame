# 09-sacrificial-altar-spherical

`sacrificial_altar` is the last remaining flat-2D radius check: `findSacrificeTarget` in `game/server/index.js` selects sacrifice targets with `Math.hypot(dx, dz)` on the XZ plane only, so a friendly minion that is XZ-inside but vertically outside `sacrificeRadius` can still be consumed. Convert the sacrifice-target search to true 3D spherical distance, passing the cast origin Y through from the card handler, and cover it with height-aware tests.

## Acceptance Criteria

- `findSacrificeTarget` in `game/server/index.js` accepts the cast origin Y and selects targets using 3D spherical distance via `sphericalDistanceToEntity` (which resolves entity Y through `getEntityWorldY`), not `Math.hypot(dx, dz)`.
- The `sacrificial_altar` branch in `game/server/cardEffects.js` passes the in-scope `originY` into `findSacrificeTarget` alongside `originX`/`originZ`.
- A friendly minion at a different height than the cast origin but within `sacrificeRadius` 3D distance IS found and sacrificed (test in `game/server/test/spherical_aoe_cards.test.js`).
- A friendly minion whose XZ distance is within `sacrificeRadius` but whose 3D distance exceeds it (large dy) is NOT sacrificed; with no other candidates the cast fails with the `'No friendly summon to sacrifice'` CARD_ERROR (test in `game/server/test/spherical_aoe_cards.test.js`).
- Ground-level (same-Y) sacrifice behavior is unchanged, including the oldest-minion-first tie-break ordering.
- Existing test suites still pass (`pnpm test:quick` from `game/`), including `integration.test.js`, `card_acquisition.test.js`, and `height_aware_projectiles.test.js`.

## Technical Specs

- `game/server/index.js` (~line 827): change the signature to `findSacrificeTarget(playerId, x, y, z, radius)` and replace the filter's `Math.hypot(minion.x - x, minion.z - z) <= radius` with `sphericalDistanceToEntity(x, y, z, minion) <= radius`. Both `sphericalDistanceToEntity` and `getEntityWorldY` are already imported from `./simulation` at the top of `index.js` (~lines 175–176). Keep the owner/hp filter and the `createdAt`/index sort exactly as-is. A null/undefined `y` already falls back to the floor height at (x, z) inside `sphericalDistanceToEntity` — never to 2D behavior.
- `game/server/cardEffects.js` (~line 685, inside `executeUseCard`): update the call in the `cardDef.effect === 'sacrificial_altar'` branch to `findSacrificeTarget(socket.playerId, originX, originY, originZ, sacrificeRadius)`. `originY` is already computed in this function scope (~lines 344–346).
- `game/server/test/height_aware_projectiles.test.js` (~line 37) stubs `findSacrificeTarget: () => null` via `setCallbacks` — the stub ignores arguments, so it needs no change, but verify the suite still passes.
- `game/server/test/spherical_aoe_cards.test.js`: add a `sacrificial_altar` describe block following the file's existing pattern for elevated in-sphere / XZ-inside-but-out-of-sphere cases: (1) elevated minion with dy small enough that 3D distance ≤ `sacrificeRadius` is consumed (minion removed from `state.minions`, magic stones gained); (2) minion XZ-inside but with dy large enough that 3D distance > `sacrificeRadius` is not consumed and the cast emits CARD_ERROR `'No friendly summon to sacrifice'`; (3) same-Y minion at XZ distance ≤ `sacrificeRadius` is still consumed (regression guard).

## Verification: code
