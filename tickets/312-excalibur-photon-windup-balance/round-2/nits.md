## Clean Up Wind-Up Unit Test Disconnect Noise

`coverage.log` shows a caught `[socket:disconnect] handler error` during `server/test/card_windup_resolution.test.js` because the unit fixture installs a minimal `state.run` without the normal objective shape before disconnecting. The suite still passes and the captured game run is clean, but the fixture should use a normal run/objective or disconnect after clearing the lobby state so future coverage logs stay signal-rich.

### Acceptance Criteria
- The full Vitest suite still passes with no `[socket:disconnect] handler error` emitted by `server/test/card_windup_resolution.test.js`.
