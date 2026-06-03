# Client visual marker for variant enemies

Give the renderer a visual marker for enemies whose snapshot carries a `variant`
field: a tint (emissive/color shift) and/or a small badge above the enemy mesh,
so a variant enemy is visually distinguishable from a normal one. The marker is
applied/removed driven purely by the `variant` field on the enemy in each state
update.

## Acceptance Criteria

- When an enemy in the `stateUpdate` snapshot has a truthy `variant`, its mesh
  receives a distinguishing marker (a color/emissive tint and/or a badge mesh)
  in addition to its normal type-based appearance.
- An enemy without `variant` renders exactly as it does today (no marker).
- The marker is keyed off `enemy.variant` each update, so it appears for variant
  enemies and is absent for non-variant enemies (no stale marker if an enemy id
  is reused). Any badge mesh created is disposed/cleaned up with the enemy mesh.
- The marker code path does not throw when `variant` is undefined/null (the
  common case) and does not regress existing enemy rendering, health bars,
  telegraphs, or lock-on rings.
- Existing client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/client/renderer.js`: in the per-enemy update loop (~3925, where
  `enemiesMeshes[enemy.id]` is created/positioned), branch on `enemy.variant`.
  Reuse `createEnemyMesh`'s emissive bookkeeping (`mesh._origEmissive` /
  `mesh._origEmissiveIntensity`) so the tint can be applied and reverted cleanly,
  or add a small badge mesh tracked in a registry alongside `enemyHealthBars` /
  `telegraphMeshes` and disposed via the same `disposeOne` cleanup pattern.
- Add a helper (e.g. `applyVariantMarker(enemyId, enemy)`) near the other enemy
  visual helpers (`applyWindupFlash`, `applyRevealHighlight`) and call it from
  the update loop.
- No server changes; consume the `variant` field already present on the snapshot
  enemy (added in sub-ticket 01).

## Verification: code
