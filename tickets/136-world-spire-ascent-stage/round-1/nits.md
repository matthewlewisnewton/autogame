## Vestigial `spawnWeight` on spire tiers

`generateSpireAscent` sets each tier's `spawnWeight` to `isBottom ? 0 : isTop ?
2 : 0`, but spire enemy placement (`pickSpireAscentEnemySpawn`) ignores
`spawnWeight` entirely and distributes by `tierIndex` buckets. The field is
misleading: middle tiers carry `spawnWeight: 0` yet do receive enemies. Either
drop the field from spire tiers or make it reflect actual distribution.

### Acceptance Criteria
- Spire tier `spawnWeight` values are either removed or made consistent with how
  `pickSpireAscentEnemySpawn` actually distributes enemies.
- No behavioural change to enemy/objective placement; existing spire tests stay
  green.

## Ramp built via swapped `yHigh`/`yLow` args

`generateSpireAscent` calls `buildDescentRampRoom({ yHigh: yLow, yLow: yHigh,
axis: 'z' })` — passing the two height args swapped to invert the slope so the
floor rises toward +Z (the upper tier). It is geometrically correct but reads
backwards at the call site. A short comment, or a dedicated ascent-ramp helper /
direction flag, would make intent obvious.

### Acceptance Criteria
- The ramp-direction inversion is self-documenting (comment, named helper, or a
  direction parameter) rather than relying on swapped argument names.
- Ramp `floorCorners` and slope tests remain unchanged and green.

## Capture exercised `sloped-dungeon` instead of the spire scenario

The round-1 capture fell back to the `sloped-dungeon` smoke
(`capturePlanSource: "fallback"`), so no screenshot shows the actual spire
stack. The new `?debugScenario=spire-ascent` shortcut exists specifically for
this; the capture plan should drive it for real visual coverage of the multi-
tier climb.

### Acceptance Criteria
- The capture plan for spire-ascent invokes `?debugScenario=spire-ascent` (or
  `spire-ascent-stage`) and produces at least one screenshot showing stacked
  tiers / a ramp at elevation.
