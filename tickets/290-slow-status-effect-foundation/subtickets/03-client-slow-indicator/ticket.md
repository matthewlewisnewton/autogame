# Client visual indicator for slowed entities

Render a visual indicator on any entity (player or enemy) that is currently
slowed, driven by the `slowedUntil` field in the broadcast snapshot. Because no
card/enemy slows anything yet (the ice enemy 293 and ice card 294 land later),
this cannot be confirmed in a happy-path screenshot run — it is verified by
reading the rendering logic in the diff.

## Acceptance Criteria
- The renderer reads each entity's `slowedUntil` (and may use `slowFactor`) from
  the game-state snapshot and shows a distinct slow indicator while
  `Date.now() < slowedUntil` for that entity.
- The indicator is applied for enemies (in the per-frame enemy update loop) AND
  for players (in the per-frame player update loop).
- The indicator visually differs from the existing freeze/frozen and other
  status visuals (e.g. a cool-blue tint or an overhead/ground marker), and is
  removed/hidden once `slowedUntil` has passed (no permanent stuck indicator).
- Indicator meshes/state are cleaned up when an entity is removed (no leak of
  per-entity indicator objects after the entity despawns).

## Technical Specs
- `game/client/renderer.js`:
  - In the enemy update loop (around lines 4564-4593, where each `enemy` mesh,
    health bar, and hitbox are positioned each frame), add a check on
    `enemy.slowedUntil` and apply/update a slow indicator (e.g. reuse a tint
    helper like `flashMesh`/material emissive, or add a small overhead/ground
    marker mesh tracked in a `enemySlowMarkers`-style map keyed by enemy id and
    positioned like the existing `variantMarkerMeshes`/`enemyHealthBars`).
  - In the player update loop (around lines 4382-4411, iterating
    `Object.entries(gs.players)`), apply the same indicator when
    `pData.slowedUntil` is active.
  - Ensure indicators clear when the timestamp passes and when the entity is
    disposed (follow the existing `disposeStaleMeshes(...)` /
    nameplate-cleanup pattern around lines 4541-4543, 4737).
- Use only `slowedUntil`/`slowFactor` exposed in the snapshot by sub-ticket 02.

## Verification: code
