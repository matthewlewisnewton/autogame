# Implement monster-card debug scenario

The `monster-card` debug scenario sets HP/magic stones but never guarantees a monster card in hand, unlike `summon-ready` which does for summons. This causes the integration test to fail and prevents visual capture from exercising a monster card.

## Acceptance Criteria

- `applyDebugScenario('monster-card')` in `game/server/index.js` guarantees at least one `type: "monster"` card in the player's hand after init, mirroring the `summon-ready` pattern (find a non-monster slot, replace with `dungeon_drake`).
- The stale `checkAllReady` comment is removed or replaced with accurate documentation.
- Integration test `"monster-card" guarantees a monster card in hand` passes (finds a monster slot ≥ 0 with `id: "dungeon_drake"`).
- No regression: existing `summon-ready` scenario still works.

## Technical Specs

- **File:** `game/server/index.js` — `applyDebugScenario`, `monster-card` branch (~line 995–1001). After `initPlayerHand()` (called above in the shared code path), add: if `!player.hand.some(c => c && c.type === 'monster')`, find first non-monster slot and replace with `{ id: 'dungeon_drake', name: 'Dungeon Drake', type: 'monster', charges: 1, remainingCharges: 1 }`. Remove the misleading `checkAllReady` comment.
- **File:** `game/server/test/integration.test.js` — verify `"monster-card" guarantees a monster card in hand` test passes.

## Verification: code
