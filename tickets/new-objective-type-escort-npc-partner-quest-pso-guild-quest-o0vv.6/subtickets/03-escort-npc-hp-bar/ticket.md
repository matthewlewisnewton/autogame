# Visible HP bar above the escort NPC

The escort NPC takes damage on the server and the client shows damage-flash numbers, but there is no persistent HP bar, so players cannot see how close the escort is to dying. Render a floating health bar above the escort NPC mesh, mirroring the existing enemy health-bar pattern.

## Acceptance Criteria

- The client renders a horizontal HP bar floating above the escort NPC mesh for minions with `isEscort: true` (no bar for ordinary minions).
- The bar's fill width scales with `minion.hp / minion.maxHp` and its color uses the existing `healthBarColor(hp, maxHp)` helper, updating each sync as the escort takes damage.
- The bar follows the escort's position each frame/sync and is removed when the escort minion despawns (death or run end) — no orphaned bar meshes.
- A client test in `game/client/test/` covers the escort HP bar helper logic (e.g. bar creation only for `isEscort` minions and fill-scale computation from hp/maxHp).
- `cd game && npx vitest run client/test` passes (or the project's client vitest invocation, e.g. `pnpm test:quick`).

## Technical Specs

Files to change:
- `game/client/renderer/minionSync.js` — main change. The minion world-snapshot objects already include `isEscort`, `hp`, and `maxHp` (the server sends raw minion objects). Follow the enemy health-bar precedent in `game/client/renderer/enemySync.js` (~lines 156, 205, 856: a bar mesh per entity id kept in a map, positioned above the entity at `renderY + offset`, fill scaled by hp fraction, color via `healthBarColor`). Keep an `escortHealthBars` map keyed by minion id; create on first sight of an `isEscort` minion, update scale/color/position on each sync, dispose + delete when the minion disappears from the snapshot.
- `game/client/renderer/enemySync.js` — only if needed to export `healthBarColor` (it is already exported at ~line 156; re-import it in minionSync.js rather than duplicating).
- `game/client/test/` — add a small vitest file (e.g. `escort-hp-bar.test.js`) for the pure helper(s) (fill fraction / should-have-bar predicate). Keep three.js scene work behind thin testable helpers, matching how other renderer tests in that folder are structured.

## Verification: code
