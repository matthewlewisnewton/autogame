# Prefill login form after successful registration

After `/api/register` succeeds, the client calls `showLoginForm()` but never copies the username the player just typed into `#login-username`, so they must re-enter it. Fix the register success path so the login form is ready to use: either log the player in immediately with the credentials already in hand, or (minimum) prefill the login username, clear the login password, and move focus to the password field while keeping the green “Account created — please login” message.

## Acceptance Criteria

- On successful `POST /api/register` (201), the client either calls the existing login/session-restore flow so the player lands in the lobby without retyping credentials, **or** sets `#login-username` to the trimmed username just registered, clears `#login-password`, and focuses `#login-password`.
- The login form is visible (`#login-form` not hidden, `#register-form` hidden) after success, and `#login-error` still shows `Account created — please login` when using the prefill path.
- Manual toggle between forms (`#show-login-link`, `#show-register-link`) and `clearAuthForms()` behavior are unchanged except where the register-success path intentionally pre-fills login.
- `game/client/test/main.test.js` gains a regression test that mocks a successful register response and asserts the post-flip login username value and password focus (or auto-login side effects such as token storage / `hideAuthOverlay`).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/client/main.js`
  - Register button handler (~lines 3708–3742): in the `res.ok` branch, after `showLoginForm()`, set `#login-username` to the registered `username`, clear `#login-password`, and call `.focus()` on the password input **before or after** setting the success message on `#login-error` (note `showLoginForm()` clears `#login-error` today — set the green success copy afterward, as now).
  - **Alternative (also acceptable):** instead of flipping to login, `POST /api/login` with the same `{ username, password }`, persist the returned token via `localStorage` + `restoreSession()` — same pattern as the login button handler (~3767–3769). Do not change server auth routes.
  - Optional small refactor: extend `showLoginForm(prefillUsername)` if that keeps the handler tidy; do not clear prefilled username when applying the success message.
- **Edit:** `game/client/test/main.test.js`
  - In the `auth overlay functions` describe block (or adjacent), add a test that stubs `global.fetch` for `/api/register` → `{ ok: true, status: 201, json: () => ({ accountId: 'test-id' }) }`, fills register inputs, clicks `#register-btn`, awaits microtasks, and asserts `#login-username`.value matches the registered name and `#login-password` is focused (or asserts auto-login outcome if that approach is chosen).
  - If `showLoginForm` signature changes, update existing tests only as needed; keep `clearAuthForms` and manual toggle tests passing.

## Verification: code
