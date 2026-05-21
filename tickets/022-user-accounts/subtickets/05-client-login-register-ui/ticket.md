# Client Login / Registration UI

Add a login and registration overlay to the client so players can create an account, log in, and connect to the WebSocket with their JWT token. The overlay appears before the game lobby; after successful login the token is stored in `localStorage` and sent in the Socket.IO `auth` payload on reconnect.

## Acceptance Criteria
- `game/client/index.html` contains a `#auth-overlay` div (hidden after login) with:
  - A registration form: username input, password input, "Register" button, error message span.
  - A login form: username input, password input, "Login" button, error message span.
  - A toggle link ("No account? Register" / "Have an account? Login") to switch between forms.
- `game/client/style.css` contains styles for `#auth-overlay` (centered modal, forms stacked vertically, visible above the lobby).
- `game/client/main.js`:
  - On page load, checks `localStorage.getItem('autogame_token')`. If present, connects Socket.IO with `{ auth: { token } }` and skips the auth overlay.
  - If no token, shows `#auth-overlay` and hides `#lobby`.
  - "Register" button POSTs to `/api/register` with JSON body; on 201, switches to login form; on error, shows the error message.
  - "Login" button POSTs to `/api/login` with JSON body; on 200, stores the returned token in `localStorage`, reconnects Socket.IO with `{ auth: { token } }`, and hides the overlay.
  - On `init` from server, if `accountId` is present, displays the username somewhere in the UI (e.g., replaces "Connecting..." status with "Logged in as {username}").
  - A "Logout" button (visible after login) clears the token from `localStorage`, disconnects the socket, and re-shows the auth overlay.
- Unit test for `showAuthOverlay` / `hideAuthOverlay` rendering functions (extracted from main.js or tested via DOM query in a unit test file).

## Technical Specs
- **Modify**: `game/client/index.html` — add `#auth-overlay` HTML structure with two forms and a logout button in `#ui`.
- **Modify**: `game/client/style.css` — add CSS for `#auth-overlay`, form inputs, buttons, error spans, and `.hidden` utility class.
- **Modify**: `game/client/main.js` — add auth overlay logic, `fetch()` calls to `/api/register` and `/api/login`, `localStorage` token management, and Socket.IO reconnect with JWT in `auth` payload. Extract `showAuthOverlay()` and `hideAuthOverlay()` as testable pure-DOM functions.
- The Socket.IO connection should be lazy-created (not at module top level) so it can be re-established with auth after login. Alternatively, use `socket.connect()` / `socket.disconnect()` and update auth before reconnecting.

## Verification: code
