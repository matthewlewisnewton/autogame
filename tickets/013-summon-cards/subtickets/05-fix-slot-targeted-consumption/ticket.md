# Fix: Slot-Targeted Summon Consumption

The server's `cardUsed` broadcast for summon plays omits `slotIndex`. The client confirmation handler searches `hand` by card id and removes the *first* matching slot — wrong when two `battle_familiar` cards occupy the hand simultaneously.

## Acceptance Criteria
- The server's summon `cardUsed` payload includes `slotIndex: data.slotIndex`
- The client `cardUsed` handler, when confirming a local summon play, removes the card at `hand[data.slotIndex]` directly (after a bounds check) instead of searching by card id
- Playing a summon from slot 3 when slot 1 holds an identical summon removes slot 3, not slot 1
- The activation flash (`playActivationEffect`) and the consumed slot stay visually aligned

## Technical Specs
- **`game/server/index.js`**:
  - In both summon `cardUsed` emits (success at `index.js:313-320` and any future path), add `slotIndex: data.slotIndex` to the emitted object
- **`game/client/main.js`**:
  - In the `cardUsed` handler, replace the `for` loop that searches `hand` by `data.cardId` with a direct `hand[data.slotIndex]` access (guarded by `data.slotIndex >= 0 && data.slotIndex < hand.length`)
  - Set `hand[data.slotIndex] = null`, draw replacement, call `renderHand()`

## Verification: code
