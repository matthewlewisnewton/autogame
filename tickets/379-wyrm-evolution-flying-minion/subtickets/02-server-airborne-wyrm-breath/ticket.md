# Server — Archive Wyrm airborne fire breath

Make Archive Wyrm fire breath originate at the minion's **airborne** world Y and hit elevated targets using the height-aware cone path from ticket 375. Vault Wyrm (`dungeon_drake`) grounded breath behavior must stay unchanged.

## Acceptance Criteria

- `lockMinionBreathDirection` and `applyWyrmBreathTick` for a flying `ancient_wyrm` use `getEntityWorldY(minion)` (floor + altitude), not floor height alone.
- A flying Archive Wyrm's breath cone damages an elevated enemy at the same `(x, z)` when aimed upward (`breathDirY > 0`); `dungeon_drake` grounded breath test in `height_aware_projectiles.test.js` remains green.
- `queueWyrmBreathCardUsed` includes `origin.y` set to the minion's resolved world Y when the minion is airborne (`flying: true`); grounded wyrm events omit `origin.y` or leave it undefined so clients keep legacy ground placement.
- Pending `CARD_USED` breath payloads for `ancient_wyrm` carry tilted `direction.y` when targeting above/below the minion.
- `ancient_wyrm.test.js` breath-channel tests seed minions with `flying: true` and `altitude` so `updateMinions` resolves airborne `y` before AI runs.
- No regression in existing Vault Wyrm burn/breath tests (`vault_wyrm_burning.test.js`, `ancient_wyrm.test.js` fire-vs-burn assertions).

## Technical Specs

- **`game/server/simulation.js`**:
  - `queueWyrmBreathCardUsed`: extend `origin` to `{ x, z, y? }` where `y` is `getEntityWorldY(minion)` when `minion.flying`.
  - Confirm `applyWyrmBreathTick` / `lockMinionBreathDirection` already pass `originY`/`dirY` into `collectConeHits` (375); fix only if flying minions still resolve to floor Y at breath time.
- **`game/server/test/height_aware_projectiles.test.js`**: update the `ancient_wyrm` elevated-target case to spawn a **flying** minion at `floorY + altitude` (not hard-coded `y: 0`); assert damage and `direction.y > 0`.
- **`game/server/test/ancient_wyrm.test.js`**: breath AI fixtures include `flying` + `altitude`; add assertion that `_pendingMinionBreaths[0].origin.y` matches airborne world Y when breath fires.
- **`game/server/test/server.test.js`**: if any `_pendingMinionBreaths` ancient_wyrm fixture exists, align with optional `origin.y`.

## Verification: code
