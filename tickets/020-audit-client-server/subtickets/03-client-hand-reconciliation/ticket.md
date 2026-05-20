# Client Hand Reconciliation — Full Field Comparison

The client's hand reconciliation in the `stateUpdate` handler only compares `localCard?.id !== serverCard?.id`. When the server corrects a card's `remainingCharges` (or other fields like `charges`) without changing the card id, the client ignores the correction and displays stale charge counts. Reconcile all authoritative fields per slot and re-render whenever any field differs.

## Acceptance Criteria
- On every `stateUpdate`, the client compares the full server card object for each slot against the local copy — not just the `id` field.
- If any field differs (e.g., `remainingCharges`, `charges`, `id`, or any other field on the server card), the client replaces the local slot with a copy of the server card and triggers a re-render.
- A slot that is `null` on the server but populated locally is cleared to `null`.
- A slot that is populated on the server but `null` locally is filled from the server.
- The reconciliation still only runs when `gamePhase === 'playing'` and the server hand exists.

## Technical Specs
- **File**: `game/client/main.js` — In the `stateUpdate` handler, replace the current hand reconciliation block:
  ```javascript
  // Current (broken):
  if (localCard?.id !== serverCard?.id) {
    hand[i] = serverCard ? { ...serverCard } : null;
    changed = true;
  }
  ```
  With a deep comparison approach:
  ```javascript
  const serverCard = serverHand[i];
  const localCard = hand[i];
  if (!serverCard && !localCard) continue;
  if (!serverCard || !localCard || localCard.id !== serverCard.id ||
      localCard.remainingCharges !== serverCard.remainingCharges ||
      localCard.charges !== serverCard.charges) {
    hand[i] = serverCard ? { ...serverCard } : null;
    changed = true;
  }
  ```
  This compares `id`, `remainingCharges`, and `charges` — the three fields the server tracks per hand card. If any differ, replace the local slot and mark as changed.
- **No other files changed.** Do not modify server files, `hand.js`, config, or tests.

## Verification: code
