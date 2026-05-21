# Load Saved Player Data on Connect

Replace transient Socket.IO ids with a stable player identity, call `provider.loadPlayer()` during connection, and merge restored currency, inventory, loadout, and location into the new player state before emitting `init`.

## Acceptance Criteria
- On first connection, the server generates a stable `playerId` (UUID) and includes it in the `init` payload sent to the client.
- On subsequent connections, the client sends its stable `playerId` (via handshake auth or a post-connect message), and the server uses it to look up persisted data.
- `provider.loadPlayer(stablePlayerId)` is called during the connection flow.
- When saved data exists, the server merges `currency`, `ownedCards`, `selectedDeck`, and location fields (`x`, `y`, `z`, `rotation`) into the newly created player state.
- When no saved data exists, the server falls back to the default starting state (current behavior).
- The `init` emit uses the merged player state so the client receives restored values immediately.

## Technical Specs
- **Files**: `game/server/index.js`
- Generate a stable `playerId` (e.g., `crypto.randomUUID()`) on first connect and include it in the `init` payload.
- Accept the stable `playerId` back from the client on reconnect — via Socket.IO handshake `auth.playerId` or a `restoreSession` message after connect.
- Call `provider.loadPlayer(stablePlayerId)` and, if the result is non-null, merge `currency`, `ownedCards`, `selectedDeck`, `x`, `y`, `z`, `rotation` into the player object created in the connection handler.
- Use the stable `playerId` as the key in `gameState.players` instead of `socket.id` (or map `socket.id` → `playerId` so saves/loads use the stable id).
- **File**: `game/client/main.js` (or equivalent client entry)
- Store the stable `playerId` in `localStorage` on first `init`, and send it back on reconnect (via `auth` or `restoreSession`).

## Verification: code
