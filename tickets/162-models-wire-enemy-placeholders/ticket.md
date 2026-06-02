# Models: Wire enemy + minion placeholders into the registry

Wire the committed CC0 placeholder `.glb` models into the model registry (built in
ticket 161) for enemies and minions, replacing their procedural primitives.
Retain the procedural fallback. The **player is intentionally excluded** — the
hero is owned by the character-customization epic (181–188).

## Difficulty: medium

## Goal

For each entity below, set its registry model path so the loaded `.glb` renders in
place of the primitive, scaled to roughly the primitive's current size and grounded
correctly.

## Acceptance Criteria

- Registry maps these entity keys to files under `/models/`:
  - `grunt` → `grunt.glb`, `skirmisher` → `skirmisher.glb`,
    `miniboss` → `miniboss.glb`, `spawner` → `spawner.glb`
  - minions: `ancient_wyrm` → `minion-ancient-wyrm.glb`,
    `null_crawler` → `minion-null-crawler.glb`,
    `bulkhead_mauler` → `minion-bulkhead-mauler.glb`
- Each loaded model is scaled to approximately match the entity's current
  primitive footprint/height and sits on the ground (feet at the entity's y, not
  centered through the floor).
- Player is NOT changed (stays procedural; customization epic owns the hero).
- A missing/failed model falls back to the procedural mesh (per 161); the game
  still starts and loads cleanly.
- Existing server+client tests pass; the capture shows the new enemy/minion meshes.

## Technical Specs

- `game/client/models.js` — set `MODEL_REGISTRY` paths for the 7 entities above.
- `game/client/renderer.js` — apply per-entity scale/ground-offset normalization
  when a registry model is used.
- Models are ALREADY committed under `game/client/public/models/` (CC0 — see
  `CREDITS.md`). Do NOT add, author, or re-export models in this ticket.

## Dependencies

- 161-models-gltf-loader-infrastructure (registry + loader must exist first)

## Verification

`Verification: visual`
