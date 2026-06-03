# Minion GLB registry paths (ancient_wyrm, null_crawler, bulkhead_mauler)

Set `MODEL_REGISTRY` paths for the three minion types so `createMinionMesh`
loads the committed CC0 placeholder `.glb` files when assets resolve. Depends on
sub-tickets 01 (normalization) and 02 (enemy paths may already be set).

## Acceptance Criteria

- `MODEL_REGISTRY` maps:
  - `ancient_wyrm` → `/models/minion-ancient-wyrm.glb`
  - `null_crawler` → `/models/minion-null-crawler.glb`
  - `bulkhead_mauler` → `/models/minion-bulkhead-mauler.glb`
- `modelPathFor` returns the correct path for each minion key.
- `createMinionMesh(minionType)` still returns procedural mesh synchronously;
  async load swaps in a normalized model using `MINION_VISUAL` footprint (including
  `ancient_wyrm` `scale: 1.5`).
- Enemy paths from sub-ticket 02 remain set; `player` remains `null`; loot keys
  remain `null`.
- Committed files exist at the three `minion-*.glb` paths under
  `game/client/public/models/`; do not author or re-export models.
- `pnpm test` (from `game/`) passes.

## Technical Specs

- `game/client/models.js` — set the three minion `MODEL_REGISTRY` values.
- No renderer changes expected unless minion footprint lookup needs a fix for
  `MINION_VISUAL` box/octahedron shapes.
- Filenames match `game/client/public/models/CREDITS.md` ledger rows.

## Verification: code
