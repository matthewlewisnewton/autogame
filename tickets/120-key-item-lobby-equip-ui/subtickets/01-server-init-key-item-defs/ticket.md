# Send KEY_ITEM_DEFS in Server Init Event

Add `KEY_ITEM_DEFS` to the server's `init` socket emit so the client can render key item names, descriptions, and cooldowns in the lobby equip UI.

## Acceptance Criteria

- Server `init` emit includes `keyItemDefs: KEY_ITEM_DEFS` in the payload
- Client captures `keyItemDefs` from the `init` event and stores it in a module-level variable
- Existing `init` payload fields remain unchanged (no regression)
- Tests pass with `pnpm test`

## Technical Specs

- **File**: `game/server/index.js`
  - In the `socket.emit('init', {...})` block (around line 2835), add `keyItemDefs: KEY_ITEM_DEFS` to the payload object
- **File**: `game/client/main.js`
  - In the `s.on('init', (data) => {...})` handler (around line 783), capture `keyItemDefs` from destructuring: `const { ..., keyItemDefs } = data`
  - Store in a module-level variable: `let keyItemDefs = {};` (declare near other module-level state like `mySelectedDeck`)
  - Assign: `keyItemDefs = keyItemDefs || {};`

## Verification: code
