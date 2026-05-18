# Fix: Server-Side Single-Use Enforcement for Summons

The server `useCard` summon branch only gates on Magic Stones — it has no knowledge of card charges or whether the same card was already resolved. A rapid double-press (two key hits before the first `cardUsed` round-trip returns) causes the server to resolve a second AoE and deduct another 50 Magic Stones from one nominally single-use card.

## Acceptance Criteria
- Pressing a summon card's key twice in rapid succession (before the first `cardUsed` arrives) results in exactly **one** AoE resolution and **one** Magic Stones deduction
- The server rejects the duplicate activation with a `cardError` event (or silently drops it), so the client never sees two `cardUsed` broadcasts for one press
- Normal single presses behave exactly as before: one AoE, one cost deduction, one `cardUsed` broadcast

## Technical Specs
- **`game/server/index.js`**:
  - Add a per-player `pendingSummons: Set` field (keyed by `${slotIndex}:${cardId}`) initialized on connect
  - In the summon branch of `useCard`, before deducting cost or applying damage, check `if (player.pendingSummons.has(key))` — if true, emit `cardError` with `reason: 'Summon already resolving'` and `return`
  - After the cost check passes, add the key to `pendingSummons`
  - Clear the pending entry when the server broadcasts `cardUsed` for that summon (or on the next `stateUpdate` tick as a safety net)
  - Alternatively: clear `pendingSummons` entries on the next `stateUpdate` tick for any entry whose `slotIndex` card was consumed (simplest: clear the whole set each tick since a summon resolves in <1 tick)
- **`game/client/main.js`**:
  - No client-side changes required for this gap — the existing slot cooldown already prevents most double-presses, but the server guard is the authoritative enforcement

## Verification: code
