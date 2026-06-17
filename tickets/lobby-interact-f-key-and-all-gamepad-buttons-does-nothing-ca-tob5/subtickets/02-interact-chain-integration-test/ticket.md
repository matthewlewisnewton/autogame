# Integration test: full interact → booth open chain

The existing `boothPrompt.test.js` verifies the keyboard F key emits `boothInteract` on the socket, and `boothZones.test.js` verifies the server responds with `boothAction`. However, there is no test covering the complete chain from user input through the server round-trip to the booth actually opening on the client. Add an integration test that validates the end-to-end flow to catch regressions and confirm the reported bug is resolved.

## Acceptance Criteria

- A new test verifies: pressing F while in range of a hub booth causes the server to respond with `boothAction`, and the client dispatches `BOOTH_ACTION_EVENT` which opens the corresponding booth UI
- The same chain is verified for the gamepad interact button (D-pad Up)
- The test confirms that pressing F when out of range produces no socket emission and no booth open
- The test confirms that the server rejects interactions when the player is out of range (emits `boothError` with `out_of_range`)
- All existing booth and input tests continue to pass

## Technical Specs

**Files to change:**
- `game/client/test/boothPrompt.test.js` — extend the existing `emits boothInteract for the in-range booth` test to also verify: (a) the server `boothAction` response triggers `dispatchBoothAction`, (b) the `BOOTH_ACTION_EVENT` listener opens the booth UI (mock `showGameLobby` / `setLobbyTab`), (c) gamepad D-pad Up triggers the same chain as keyboard F
- Alternatively, create a new file `game/client/test/booth-interact-chain.test.js` if the existing test file is too focused on the prompt primitive

**Key implementation details:**
- Use the existing `generateHub(0)` to get booth anchors and positions
- Mock the socket round-trip: after `socket.emit('boothInteract', ...)`, manually emit `socket.emit('boothAction', ...)` to simulate server response
- Verify `BOOTH_ACTION_EVENT` fires with the correct `boothId` in `detail`
- For gamepad: use `pollInput()` with a mocked gamepad snapshot having D-pad Up pressed

## Verification: code
