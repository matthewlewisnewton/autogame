# Client test: monster happy-path authority

`main.test.js` covers the monster cooldown-not-consumed edge case but lacks a test for the happy path: playing a monster card, receiving `stateUpdate` from the server with a replaced hand, and verifying the client does NOT call `drawCard()` (server authority).

## Acceptance Criteria

- `game/client/test/main.test.js` contains a new test that:
  1. Places a monster card (`type: "monster"`) in a hand slot with cooldown cleared.
  2. Calls `useCard` (via `__useCardForTest`) on that slot.
  3. Simulates a `stateUpdate` socket event with a new hand from the server (monster slot replaced by a different card).
  4. Asserts that the client-side `drawCard()` was never invoked during the flow.
  5. Asserts that `hand[slot]` matches the server-provided replacement card from `stateUpdate`.

## Technical Specs

- **File:** `game/client/test/main.test.js`
- Add a new `it()` block in the existing `useCard()` describe section (after the cooldown tests around line 1300).
- Use `window.__triggerSocketEvent('stateUpdate', state)` from `test/setup.js` to fire the server state update.
- Spy on `drawCard` from `hand.js` (e.g., via `vi.spyOn`) to assert it was never called.
- The `stateUpdate` payload should include `gamePhase: 'playing'`, `players: { [myId]: { hand: [...] } }` with the monster slot replaced.

## Verification: code
