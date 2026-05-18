# Summon AoE Visual Effect

Render a large area-of-effect visual on the client when a summon card is used — an expanding ring or sphere at the player's position that fades over ~1 second.

## Acceptance Criteria
- When the client receives a `cardUsed` event for a summon-type card, a visual effect is spawned at the `origin` position
- The effect is a ring or expanding sphere whose radius grows from 0 to the summon radius (e.g. 10 units) over ~600-800 ms, then fades out and is removed
- The effect uses a color distinct from weapon attacks (e.g. amber/orange `#f59e0b` to match summon card styling)
- The effect is added to the existing `activeEffects` array and cleaned up by the same `updateAttackEffects` loop (or a parallel summon-effects loop)
- Multiple simultaneous summons do not crash or leak memory

## Technical Specs
- **`game/client/main.js`**:
  - Create a `spawnSummonEffect(origin, radius)` function that builds a `THREE.RingGeometry` or a `THREE.SphereGeometry` mesh with an emissive amber material
  - Add the mesh to `scene` and push an entry to `activeEffects` with fields: `{ mesh, origin, radius, createdAt, duration }`
  - In `updateAttackEffects()`, distinguish summon effects from weapon effects (e.g. by presence of a `radius` field on the effect object); for summons, scale the mesh from 0→`radius` over the first portion of the duration, then fade opacity to 0
  - In the `cardUsed` socket handler, add a branch for summon cards (check `data.radius !== undefined` or check card type against `CARD_DEFS`), and call `spawnSummonEffect(data.origin, data.radius)`
- **`game/client/cards.js`** (optional):
  - If needed, export a `summonCardIds` Set similar to the existing `weaponCardIds` for type-checking in the `cardUsed` handler

## Verification: code
