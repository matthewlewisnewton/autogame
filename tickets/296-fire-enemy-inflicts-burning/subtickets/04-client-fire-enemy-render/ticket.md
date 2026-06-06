# Client Ember Wraith mesh and lock-on panel

Give `ember_wraith` a distinct procedural mesh and attack telegraph in the renderer, and verify the lock-on info panel shows name, surfaced stats (including burn duration), and description from the display catalog. Player burning flame VFX already exists (ticket 291) and activates automatically when `burningUntil` is broadcast — no new burn VFX required unless the mesh registration is missing.

## Acceptance Criteria

- `createEnemyMesh('ember_wraith')` returns a distinct mesh (not the grunt fallback): warm orange/red emissive geometry registered in `ENEMY_GEOMETRY`.
- `enemyMeshHalfHeight('ember_wraith')` and registry footprint helpers resolve correctly (extend `renderer-registry-normalize` or equivalent tests if present).
- `ENEMY_ATTACK_VISUAL['ember_wraith']` mirrors the server's cone attack style (angle/range consistent with def).
- Lock-on panel: with a living `ember_wraith` targeted, `buildLockOnPanelModel` shows the wraith `name`, HP line, surfaced stats (including readable burn duration), and `description` from the catalog.
- Client tests cover mesh creation, half-height, and panel model for `ember_wraith`.
- Vitest passes.

## Technical Specs

- `game/client/renderer.js`:
  - Add `ember_wraith` entries to `ENEMY_GEOMETRY` (e.g. smaller cone or emissive octahedron in fire palette `0xff4400` / emissive `0xff2200`) and `ENEMY_ATTACK_VISUAL` (cone telegraph matching def `attackConeAngle`).
- `game/client/lock-on-info-panel.js`:
  - Add `burnDurationMs: 'Burn duration'` to `STAT_LABELS` so the surfaced stat renders with a readable label (format as seconds or ms consistently with other duration stats).
- `game/client/test/main.test.js`:
  - Extend `createEnemyMesh()` describe block with `ember_wraith` mesh assertions (distinct color/geometry vs grunt).
- `game/client/test/lock-on-info-panel.test.js`:
  - Add case building a panel model for `type: 'ember_wraith'` using the live catalog fixture (mirror `field_medic` test).
- `game/client/test/renderer-registry-normalize.test.js` (if it lists enemy types):
  - Add `ember_wraith` footprint/half-height expectations.
- Do **not** change server combat logic or spawn pools in this sub-ticket.

## Verification: code
