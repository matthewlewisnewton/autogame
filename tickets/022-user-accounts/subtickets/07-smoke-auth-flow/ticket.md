# Auth Smoke Path for Harness Capture

The harness capture script times out before proving authenticated lobby/gameplay because `connectPlayer` navigates to a page that shows the auth overlay — the fallback recipe's subsequent steps (click ready, wait for game) never succeed. Add `registerUser` and `loginUser` actions to the harness so the smoke path can complete registration, login, reach the lobby, and transition into gameplay.

## Acceptance Criteria
- `harness/screenshot.mjs` — `ACTIONS` set includes `registerUser` and `loginUser`.
- `registerUser` action fills the registration form inputs (`#register-username`, `#register-password`) and clicks `#register-btn`, then waits for the response.
- `loginUser` action fills the login form inputs (`#login-username`, `#login-password`) and clicks `#login-btn`, then waits for the socket `connect` event.
- `fallbackRecipe()` is updated to register + login each player before proceeding with lobby/gameplay steps.
- The capture completes with `metrics.json` reporting `"ok": true` — at least one screenshot is produced and the probe shows `lobbyVisible: true` or `cardHandVisible: true`.
- Existing actions (`connectPlayer`, `readyAll`, `waitForGame`, `move`, `pressCard`, `clickSlot`, `wait`, `screenshot`, `probe`) remain unchanged.

## Technical Specs
- **Modify**: `harness/screenshot.mjs` —
  - Add `'registerUser'` and `'loginUser'` to the `ACTIONS` set.
  - In `validateRecipe`, accept `username` and `password` string fields on steps (non-empty, 1-64 chars).
  - In `executeRecipe`, implement `registerUser`: navigate to register form if hidden, fill `#register-username` and `#register-password`, click `#register-btn`, wait 500ms.
  - In `executeRecipe`, implement `loginUser`: navigate to login form if hidden (click `#show-login-link` if needed), fill `#login-username` and `#login-password`, click `#login-btn`, wait for socket connection (check `#status` text contains "Connected" or wait for `#auth-overlay` to hide), wait 500ms.
  - Update `fallbackRecipe()` to insert `registerUser` + `loginUser` steps after each `connectPlayer` step, using deterministic test credentials (e.g., `playerA`/`test123` and `playerB`/`test123`).
- **Modify**: `game/client/index.html` — add `data-testid` attributes to auth form elements for robust harness selection: `data-testid="register-username"`, `data-testid="register-password"`, `data-testid="register-btn"`, `data-testid="login-username"`, `data-testid="login-password"`, `data-testid="login-btn"`, `data-testid="show-login-link"`.

## Verification: code
