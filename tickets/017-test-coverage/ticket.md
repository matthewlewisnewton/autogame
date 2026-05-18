# Test Coverage

Implement automated unit and integration tests to ensure the core game mechanics (lobby, combat, cards, and server state) are stable.

## Acceptance Criteria
- A test runner is configured and integrated into the `package.json` scripts (`npm test`).
- Server-side logic (input validation, heartbeat, game state management) is covered by unit tests.
- Client-side logic (utility functions, delta-time calculations) is covered by unit tests.
- High-level socket events (connect, move, combat, disconnect) are covered by integration tests.
- Test coverage meets a minimum threshold (e.g., 70% overall).

## Technical Specs
- **Tools**: Install `jest` (or `vitest`) and `socket.io-client` (for integration testing the server).
- **Files to modify**: `package.json`, `game/package.json`, and add a new `test` directory (e.g., `game/test/` or `game/server/test/` and `game/client/test/`).
- **Scripts**: Add `"test": "jest"` to the relevant `package.json` files.
- **Integration Test Setup**: A test script that spawns a minimal HTTP server + Socket.IO server, connects a mock client, emits events, and asserts on the server's state and responses.
