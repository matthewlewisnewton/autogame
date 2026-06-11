## Reset login error color after registration success

After a successful registration, `loginErrorEl.style.color` is set to `#4ade80`. Subsequent login failures only update `textContent`, so a failed login attempt can still render in green instead of the default error color (`#fca5a5` in CSS).

### Acceptance Criteria
- On login validation failure, login API failure, or network error, `#login-error` uses the standard error color (clear inline `style.color` or set to `#fca5a5`).
- Registration success message remains green until the user attempts login or switches auth forms.

## Add unit test for registration success message placement

The fix is a one-line DOM target swap with ordering constraints (`showLoginForm()` then set `#login-error`). A focused vitest in `game/client/test/main.test.js` would lock the behavior and catch regressions if someone moves the success text back to `#register-error`.

### Acceptance Criteria
- Mock `fetch` returning `{ ok: true }` for `/api/register`, click `#register-btn`, assert `#login-error` contains `"Account created — please login"`, `#register-form` is hidden, and `#login-form` is visible.
- Assert `#register-error` is empty on the success path.
