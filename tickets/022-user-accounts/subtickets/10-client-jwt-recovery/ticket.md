# Client JWT Recovery on Bad Token

When a stored JWT is expired, malformed, or signed with an old secret, the server disconnects the socket but the client has no `connect_error` handler to recover. The player sees "Disconnected" with no way back to the login form.

Add a `connect_error` handler on the client socket that clears the bad token from localStorage, destroys the socket, hides all game/lobby UI, and re-shows the auth overlay so the user can log in again.

## Acceptance Criteria
- When the server disconnects a socket due to an invalid/expired JWT, the client receives a `connect_error` event.
- The `connect_error` handler removes `autogame_token` from `localStorage`.
- The handler hides the lobby overlay and game UI (card hand, HUD, etc.).
- The handler shows the auth overlay (login form) so the user can re-authenticate.
- After clearing the token, the client does **not** attempt to reconnect with the bad token (socket is destroyed).
- A subsequent successful login creates a fresh socket with the new token and restores normal gameplay.

## Technical Specs
- **File**: `game/client/main.js`
  - Add `s.on('connect_error', ...)` inside `bindSocketHandlers()` (alongside the existing `connect`, `disconnect`, `reconnect_attempt`, `reconnect` handlers).
  - In the handler: call `localStorage.removeItem(TOKEN_KEY)`, destroy the socket (`socket.disconnect()` or `socket.io.disconnect()`), call `showAuthOverlay()` and `showLoginForm()`, and update status text to indicate session expired.
  - Guard against re-entering: only act if `authOverlayEl` exists and the error reason relates to auth (or simply always — the server only disconnects for bad tokens, so any `connect_error` at connection time means auth failure).

## Verification: code
