## Redundant origin-Y resolution in spherical AoE helpers

Several callers resolve the origin Y once (`const oy = resolveAoeOriginY(...)`) and then pass
`oy` into `sphericalDistanceToEntity(originX, oy, originZ, entity)`, which internally calls
`resolveAoeOriginY` again. Since `oy` is already finite the second call is a cheap no-op, but
it's redundant work and slightly muddies intent. Examples: `pullEnemiesToward`,
`applyEventHorizon`, `collectRadialHits`, `applyFreezeInRadius`, `healPlayersInRadius`.

### Acceptance Criteria
- Either resolve origin Y exactly once per AoE call path, or document that
  `sphericalDistanceToEntity` accepts an already-resolved finite Y so the intent is clear.
- No behavioral change; existing spherical AoE tests still pass.

## loot_magnet computes distance twice

In `keyItemEffects.js` the loot_magnet branch first gates with
`sphericalDistanceToEntity(...) > attractRadius` and then immediately recomputes a separate
`Math.hypot(loot.x - player.x, loot.z - player.z)` for the pull direction. The XZ distance is
needed for the slide vector, but the two calls could share intermediates for clarity.

### Acceptance Criteria
- loot_magnet computes the 3D inclusion check and the XZ pull vector without an obviously
  redundant second distance pass, or with a comment explaining why both are needed.
- loot_magnet tests still pass.
