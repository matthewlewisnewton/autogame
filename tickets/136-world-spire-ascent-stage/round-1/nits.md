## Spire-ascent total rise sits exactly on the ≥10 boundary
`generateSpireAscent` sets `risePerRamp = minTotalRise / numRamps`, so the total
spawn→top Y gain is always exactly `minTotalRise` (10) regardless of tier count.
The acceptance criterion is `≥ 10`, so this passes, but there is zero margin —
any future rounding, floor-sampling offset, or change to ramp geometry could
silently push the felt gain below 10. A small headroom (e.g. target 11–12, or
add a per-ramp margin) would make the criterion robust rather than exact.
### Acceptance Criteria
- Total spawn-point-to-top-tier Y gain for every valid seed is strictly greater
  than 10 units (some margin above the criterion), not exactly 10.
- A unit test asserts the gain exceeds 10 by the chosen margin across seeds.

## spire_ascent quest objectiveType vs. top-tier crystal/loot placement
The `spire_ascent` quest uses `objectiveType: 'defeat_enemies'`, yet
`spawnCrystals`/`spawnLoot` in progression.js have dedicated spire-ascent
branches that place crystals/loot on the top tier. Confirm the intended player
objective is consistent (defeat enemies vs. collect crystals on the summit) so
the summit reward and the win condition don't read as two different goals.
### Acceptance Criteria
- The spire_ascent win condition and its top-tier objective/loot placement are
  documented as intentionally consistent (or the objectiveType is aligned with
  what is actually placed on the final tier).
