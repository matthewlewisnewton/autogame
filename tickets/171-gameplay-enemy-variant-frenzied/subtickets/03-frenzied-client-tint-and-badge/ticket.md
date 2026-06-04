# Frenzied client tint and variant badge

Give `frenzied` enemies a distinct client-side marker from the generic magenta
`test` variant badge: a variant-specific badge color and a subtle emissive tint on
the enemy mesh, driven only by `enemy.variant` in each state update.

## Acceptance Criteria

- Enemies with `variant === 'frenzied'` render with a badge color clearly different
  from the existing `test` variant marker (not the shared `VARIANT_MARKER_COLOR`
  magenta alone).
- Frenzied enemies also receive a distinguishing emissive/body tint on their main
  mesh, applied and reverted via the existing `_origEmissive` bookkeeping on enemy
  meshes (same pattern as reveal/windup flashes).
- Enemies with `variant: null` or `variant: 'test'` look unchanged from today's
  behavior (test keeps magenta badge only; no frenzied tint).
- Marker lifecycle stays correct: badge/tint appear when `variant` is `frenzied`,
  disappear when the enemy is removed or `variant` clears, and no throw when
  `variant` is undefined.
- Existing client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/client/renderer.js`: introduce a small map, e.g.
  `VARIANT_VISUALS = { test: { badgeColor: 0xc026d3, tint: null }, frenzied: {
  badgeColor: <warm red/orange>, tint: <matching emissive> } }`. Change
  `createVariantMarker(variantId)` / `applyVariantMarker(enemyId, enemy)` to pick
  badge color from the map; when `enemy.variant === 'frenzied'`, set the enemy
  mesh emissive from `VARIANT_VISUALS.frenzied.tint` and restore `_origEmissive` /
  `_origEmissiveIntensity` when the variant is absent or changes.
- Call the tint path from the per-enemy update loop next to the existing
  `applyVariantMarker` invocation (~4243).
- No server changes; consume `variant` already on the snapshot enemy.
- Optional: use debug scenario `frenzied-enemy` from sub-ticket 02 for side-by-side
  comparison with a plain grunt in manual QA.

## Verification: code
