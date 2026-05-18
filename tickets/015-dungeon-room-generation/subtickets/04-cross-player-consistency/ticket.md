# Cross-Player Layout Consistency

Ensure all players in a session see the identical dungeon layout by having the server broadcast a single authoritative seed and layout, and the client rebuild from that data on reconnect.

## Acceptance Criteria
- The server generates exactly one layout seed per process lifetime (not per-player)
- Every client receives the same `layoutSeed` and `layout` in its `init` payload
- A second client joining an existing session receives the same layout as the first client
- If a client disconnects and reconnects, it receives the same layout (seed persists across reconnects)
- The `stateUpdate` payload includes the `layoutSeed` so clients can verify consistency

## Technical Specs
- **File**: `game/server/index.js`
- Move seed generation and `generateLayout` call to server startup (inside `server.listen` callback or module init), storing on `gameState.layoutSeed` and `gameState.layout`
- Ensure the `init` emit includes `{ id, state: gameState }` — `gameState` already carries `layoutSeed` and `layout`
- Verify that `stateUpdate` broadcasts already include the layout (it's part of `gameState`, so it should be included automatically)
- Ensure the seed is NOT regenerated on new connections — only once at startup

## Verification: code
