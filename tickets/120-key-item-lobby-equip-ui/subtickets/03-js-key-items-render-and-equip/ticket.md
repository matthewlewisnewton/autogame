# Wire Key Items Tab Switching, List Rendering, and Equip Logic

Integrate the Key Items tab into `setLobbyTab()`, render all unlocked key items from `keyItemDefs` (received via the `init` socket event in sub-ticket 01), and wire click-to-equip with socket emit/response handling.

## Acceptance Criteria

- Clicking "Key Items" tab calls `setLobbyTab('keyitems')`, which shows `#key-item-loadout` and hides all other lobby panels
- On tab switch to Key Items, `renderKeyItemList()` populates `#key-item-list` with one `.key-item-entry` per item in `keyItemDefs`, showing name, description, and base cooldown
- The currently equipped item (from `gameState.players[myId].equippedKeyItemId`) has the `.equipped` CSS class
- Clicking a non-equipped entry emits `equipKeyItem` with `{ keyItemId }` on the socket
- On `keyItemEquipped` response, the list re-renders to highlight the new selection
- On `keyItemError`, the error message is displayed in `#key-item-error`
- When socket is disconnected, clicking an item shows an error instead of emitting
- Panel only renders when lobby is visible (not during active dungeon)
- Entries have `tabindex="0"`, `role="button"`, and `aria-pressed` for accessibility
- Expose `window.renderKeyItemList` for test harness

## Technical Specs

- **File**: `game/client/main.js`
  - Add `keyitems` case to `setLobbyTab()`: toggle `#key-item-loadout` visibility and `#lobby-tab-keyitems` active class; call `renderKeyItemList()` when switching to this tab
  - Implement `renderKeyItemList()`:
    - Read `equippedKeyItemId` from current state (`gameState?.players?.[myId]?.equippedKeyItemId`)
    - Clear `#key-item-list`, create `.key-item-entry` divs for each def in `keyItemDefs`
    - Each entry shows: name (bold), description (muted), cooldown (formatted as "Xs")
    - Add `.equipped` class to the entry matching `equippedKeyItemId`
    - Click handler: if `socket && socket.connected`, emit `equipKeyItem`; else show error
    - Add `tabindex="0"`, `role="button"`, `aria-label`, `aria-pressed` attributes
    - Keyboard: Enter/Space on focused entry triggers same equip logic
  - Add socket handler `s.on('keyItemEquipped', (data) => { renderKeyItemList(); })`
  - Add socket handler `s.on('keyItemError', (data) => { show error in #key-item-error })`
  - Wire tab click: `document.getElementById('lobby-tab-keyitems').addEventListener('click', () => setLobbyTab('keyitems'))`
  - Expose `window.renderKeyItemList = renderKeyItemList` for test harness

## Verification: code
