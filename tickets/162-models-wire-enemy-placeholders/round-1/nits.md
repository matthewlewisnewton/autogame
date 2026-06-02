## Visually verify minion placeholder meshes in a capture
The deterministic smoke capture never summoned a minion (`minions: []` in the
probes), so `ancient_wyrm` / `null_crawler` / `bulkhead_mauler` `.glb` models
were only exercised by code review, not by a screenshot. They share the same
`attachRegistryModel`/`normalizeRegistryModel` path as the (verified) enemies,
but a capture that summons a familiar would close the loop.
### Acceptance Criteria
- A capture exists in which at least one minion is summoned and its loaded `.glb`
  is visible, grounded, and roughly primitive-sized.

## Placeholder enemy models read dark under current lighting
In the gameplay screenshots the enemies are dominated by their red hitbox
wireframes; the swapped-in `.glb` silhouettes are hard to make out against the
dark floor. Not a correctness issue (models load and swap correctly), but the
per-entity `ENEMY_MODEL_TUNING` / `MINION_MODEL_TUNING` tables (or a lighting
tweak) could be used to improve readability when real art lands.
### Acceptance Criteria
- Enemy placeholder models are clearly distinguishable from the floor/hitbox in
  a normal gameplay capture (via scale/offset tuning or scene lighting).
