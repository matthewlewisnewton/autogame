## Capture does not visually exercise minion models

The round-2 deterministic smoke capture never summons a minion (`minions: []`
in the probe; the `Vault Wyrm` creature card is in hand but never played), so
the three minion `.glb` models (`ancient_wyrm`, `null_crawler`,
`bulkhead_mauler`) were wired and unit-tested for scale/ground normalization but
not confirmed on-screen. A capture step that plays a creature card would close
the visual loop and guard against future regressions in the minion swap path.

### Acceptance Criteria
- A capture flow plays at least one creature card so a minion spawns during the run.
- The resulting screenshot/probe shows a summoned minion mesh (procedural hidden,
  GLB attached), grounded and sized to its procedural footprint.
