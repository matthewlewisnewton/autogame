# Layout Consistency Integration Tests

Add integration tests verifying that all connected clients receive the same `layoutSeed` and `layout`, and that the layout is authoritative from the server.

## Acceptance Criteria
- Test: two clients connect to the same server and both receive the same `layoutSeed` in their `init` payload
- Test: two clients receive identical `layout.rooms` arrays (same count, same positions/sizes)
- Test: `stateUpdate` payloads include `layoutSeed` matching the original `init` seed
- Test: after `resetGameState()` (e.g., server restart), a new layout with a different seed is generated
- Test: `clampToDungeon()` prevents player movement beyond dungeon bounds
- All tests pass with `npm test`

## Technical Specs
- **Modify**: `game/server/test/integration.test.js` — add a new `describe('Dungeon layout consistency')` block
- Tests use existing `startTestServer()` and `connectClient()` helpers
- For `resetGameState` test: call `resetGameState()` between connections and verify the new `layoutSeed` differs from the first

## Verification: code
