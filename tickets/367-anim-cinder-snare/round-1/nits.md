## Cinder Snare reads more like a column than a low ground snare
`renderCinderSnare`'s comment describes "a low fiery ground coil/ring", but it
reuses `spawnInfernoPillarEffect`, whose shaft is a 4.5-unit-tall vertical fire
column that rises over ~35% of its duration (~10s at `ttlMs=30000`). The ground
ring + embers + decal do convey a ground hazard, but the tall slow-rising shaft
leans toward a "pillar" silhouette rather than a low ember snare/coil. Consider a
shorter/low-profile variant or a dedicated low coil primitive so the silhouette
matches the name more tightly.
### Acceptance Criteria
- The dominant on-ground silhouette reads as a low ember snare/coil, not a tall
  rising column, while keeping the fiery `#f97316` theme.

## Cinder Snare shares its emissive with the inferno/thermal-column cards
`CINDER_SNARE_EMISSIVE` is `0xff3b00`, identical to the thermal-column/inferno
emissive, and both render via `spawnInfernoPillarEffect`. The base color differs
(orange accent vs red), but at a glance the two fiery effects can look similar.
A small palette/shape tweak would make Cinder Snare more instantly
distinguishable from inferno_pillar in mixed combat.
### Acceptance Criteria
- Cinder Snare is visually distinguishable from inferno_pillar/thermal-column
  effects when both appear, via color, shape, or scale.
