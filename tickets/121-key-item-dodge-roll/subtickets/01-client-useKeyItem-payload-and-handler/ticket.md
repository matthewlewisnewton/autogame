# Client: fix useKeyItem payload and add keyItemUsed handler

## Description

The client's `onUseKeyItem` callback emits `useKeyItem` with **no payload**, causing the server to reject with `missing_key_item_id`. Additionally, the client has no listener for the `keyItemUsed` response event, so the player gets no feedback on success or failure.

This sub-ticket fixes the emit to send `{ keyItemId: me.equippedKeyItemId }` and adds a `keyItemUsed` handler that updates local state and provides visual feedback (brief flash on success, error message on cooldown/failure).

## Acceptance Criteria

- `onUseKeyItem` emits `socket.emit('useKeyItem', { keyItemId: me.equippedKeyItemId })` — the equipped key item ID from local player state.
- A `socket.on('keyItemUsed', ...)` handler exists that:
  - On success (`data.ok === true`): briefly flashes the key item HUD element (green pulse or similar) to confirm activation.
  - On cooldown (`data.reason === 'on_cooldown'`): briefly shows a visual "on cooldown" indicator (red flash or shake).
  - On other failure reasons: logs the reason to console (no crash, no silent swallow).
- If `me.equippedKeyItemId` is null/undefined, the emit is skipped (no socket message sent).
- Existing card-hand, settings, and lobby functionality is not regressed.

## Technical Specs

- **File**: `game/client/main.js`
  - Find `onUseKeyItem` callback (line ~714). Change:
    ```js
    onUseKeyItem: () => {
      if (gameState && gameState.gamePhase === 'playing' && socket) {
        const me = gameState.players[myId];
        if (me && me.equippedKeyItemId) {
          socket.emit('useKeyItem', { keyItemId: me.equippedKeyItemId });
        }
      }
    },
    ```
  - Add `keyItemUsed` handler in the socket event registration block (near the `keyItemEquipped` handler at line ~1038):
    ```js
    s.on('keyItemUsed', (data) => {
      if (!data) return;
      if (data.ok) {
        // Brief green flash on the key item HUD indicator
        flashKeyItemIndicator('success');
      } else if (data.reason === 'on_cooldown') {
        // Brief red flash to indicate cooldown
        flashKeyItemIndicator('cooldown');
      } else {
        console.warn('[keyItemUsed] failed:', data.reason);
      }
    });
    ```
  - Implement `flashKeyItemIndicator(type)` — find or create a small DOM element in the in-game HUD (e.g., a `#key-item-indicator` div) and apply a CSS class (`flash-success` or `flash-cooldown`) that fades out after ~400ms. If no dedicated element exists yet, flash the existing `#status` element or the key item binding label.

- **File**: `game/client/index.html` (optional, only if a dedicated indicator element is needed)
  - Add `<div id="key-item-indicator" class="hidden"></div>` inside the HUD area if a dedicated flash target doesn't already exist.

- **File**: `game/client/main.js` — CSS or inline styles for flash animation (brief opacity/scale pulse with color coding).

## Verification: code
