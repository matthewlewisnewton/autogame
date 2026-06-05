# Enemy display catalog and lock-on panel model

Expose trimmed enemy type/variant display metadata from the server registries (`ENEMY_DEFS`, `VARIANT_DEFS`) to the client, and add pure helpers that turn a live locked enemy plus that catalog into the panel view-model (name, variant label, HP text, stat rows, description).

## Acceptance Criteria

- Server builds an `enemyDisplayCatalog` object with `types` and `variants` maps; each entry includes only `name`, `description`, and `surfacedStats` (no combat tuning fields like `attackWindupMs`).
- `socket.emit('init', …)` includes `enemyDisplayCatalog`; the client stores it on connect (same lifecycle as `keyItemDefs`).
- `buildLockOnPanelModel(enemy, catalog)` returns `null` when `enemy` is missing/dead; otherwise returns `{ name, variantName, description, hpText, stats: [{ label, value }] }` where:
  - `hpText` is current `hp` / `maxHp` from the live enemy.
  - `stats` lists every type `surfacedStats` key except `hp`, using live enemy values when present and falling back to catalog/type defaults.
  - When `enemy.variant` is set, `variantName` comes from the variant catalog and variant `surfacedStats` are appended (deduped by label).
  - `description` includes the type description and, when a variant is present, the variant description (separate sentences/lines).
- Vitest covers catalog shape on the server, init payload wiring, and panel-model cases for a base grunt, a variant enemy (e.g. volatile), and a dead/missing enemy.
- Harness vitest suite passes.

## Technical Specs

- **`game/server/enemyDisplay.js`** (new) — Export `buildEnemyDisplayCatalog()` reading `ENEMY_DEFS` from `simulation.js` and `VARIANT_DEFS` from `enemyVariants.js`.
- **`game/server/index.js`** — Import catalog builder; add `enemyDisplayCatalog: buildEnemyDisplayCatalog()` to the `init` emit (~L1442).
- **`game/server/test/enemy_display_catalog.test.js`** (new) — Assert all four types and five variants appear with non-empty display fields; confirm combat keys are omitted.
- **`game/client/lock-on-info-panel.js`** (new) — Pure exports: `STAT_LABELS` map, `formatStatValue(enemy, key, catalog)`, `buildLockOnPanelModel(enemy, catalog)`.
- **`game/client/main.js`** — Add `let enemyDisplayCatalog = null`; assign from `init` handler; expose `getEnemyDisplayCatalog()` or `window.__getEnemyDisplayCatalog` for tests/renderer.
- **`game/client/test/lock-on-info-panel.test.js`** (new) — Unit tests for model builder only (no DOM/render loop in this sub-ticket).
- Do **not** add HUD markup, CSS, or lock-on visibility wiring here.

## Verification: code
