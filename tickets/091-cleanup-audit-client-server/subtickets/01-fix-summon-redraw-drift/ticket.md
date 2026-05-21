# Fix summon redraw drift in cardUsed handler

Remove the redundant client-side `drawCard()` call in the `cardUsed` socket handler for summon cards. The server already emits an authoritative `stateUpdate` with the corrected hand (including the redrawn replacement card), so the local consume-and-draw creates a brief flicker before the server tick overwrites it.

## Acceptance Criteria
- The `cardUsed` handler in `main.js` no longer calls `drawCard()` or modifies `hand[idx]` for summon cards — it only spawns visual effects and plays audio.
- Card slot visuals still update correctly from the server's `stateUpdate` (which carries the authoritative hand array).
- No other behavior in the `cardUsed` handler (weapon effects, summon AoE, hit flashes, audio) is changed.

## Technical Specs
- **File:** `game/client/main.js`
- Remove the block inside `socket.on('cardUsed', ...)` that does:
  ```js
  if (data.playerId === myId && summonCardIds.has(data.cardId)) {
    const idx = data.slotIndex;
    if (idx >= 0 && idx < hand.length) {
      hand[idx] = null;
      const newCard = drawCard();
      if (newCard) { hand[idx] = newCard; }
      renderHand();
    }
  }
  ```
- Do not touch any other part of the `cardUsed` handler, `drawCard()`, `renderHand()`, or `stateUpdate` reconciliation.

## Verification: code
