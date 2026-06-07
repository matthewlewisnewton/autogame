# Client flame animation for burning entities

Render a burning flame visual/animation on any entity (player or enemy) that is
currently on fire, driven by the `burningUntil` field in the broadcast snapshot.
Because no enemy/card lights anything on fire yet (the fire enemy 296 and
fireball card 297 land later), this cannot be confirmed in a happy-path
screenshot run — it is verified by reading the rendering logic in the diff.

## Acceptance Criteria
- The renderer reads each entity's `burningUntil` from the game-state snapshot
  and shows a distinct flame visual while `Date.now() < burningUntil` for that
  entity (an attached flame mesh/particle/emissive effect on the entity).
- The flame visual is applied for enemies (in the per-frame enemy update loop)
  AND for players (in the per-frame player update loop, local and remote).
- The flame visual animates (e.g. flicker via per-frame scale/opacity/emissive
  variation) rather than being a static sprite, and visually differs from the
  existing freeze and slow indicators (warm fire colour vs the cool/icy slow
  ring).
- The flame visual is removed/hidden once `burningUntil` has passed (no
  permanent stuck flames), and per-entity flame meshes are cleaned up when an
  entity is removed (no leak after the entity despawns).

## Technical Specs
- `game/client/renderer.js`:
  - Mirror the existing SLOW indicator implementation. Add per-entity flame
    maps near the slow maps (around lines 108-109), e.g.
    `enemyBurnMarkers` / `playerBurnMarkers`.
  - Add a `createBurnMarker()` factory and an `applyBurnIndicator(markerMap, id, entity)`
    helper next to `createSlowMarker` / `applySlowIndicator` (around lines
    3253-3290) that shows/positions the flame while `entity.burningUntil` is in
    the future and hides it otherwise, including an animated flicker.
  - Call `applyBurnIndicator` for players in the player update loop (around
    lines 4570-4581, where `applySlowIndicator` is called for
    `playerSlowMarkers`) and for enemies in the enemy update loop (around lines
    4920-4921, where `applySlowIndicator` is called for `enemySlowMarkers`).
  - Clean up flame meshes when entities despawn, following the existing
    `disposeStaleMeshes(...)` / per-id disposal pattern used for
    `playerSlowMarkers` / `enemySlowMarkers` (around lines 4727-4729 and
    4925-4928).
  - Use only the `burningUntil` field exposed in the snapshot by sub-ticket 02.

## Verification: code
