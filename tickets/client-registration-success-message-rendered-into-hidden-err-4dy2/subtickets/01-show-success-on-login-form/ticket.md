# Show registration success message on the login form after form swap

## Description

After submitting the register form, the success message "Account created — please login" is written into `#register-error` (inside the register form), then `showLoginForm()` hides the register form — so the message is invisible. Fix: write the message into `#login-error` (inside the login form) so it's visible after the swap.

## Acceptance Criteria

- After a successful registration, the login form is shown with a visible green success message ("Account created — please login")
- The success message appears in the `#login-error` element (not `#register-error`)
- The message color is green (`#4ade80`) to distinguish success from errors
- Error paths (registration failure, network error) continue to display in `#register-error` unchanged

## Technical Specs

- **File**: `game/client/main.js` — register submit handler (around line 3664)
- **Change**: In the `res.ok` branch of the register button click handler, after calling `showLoginForm()`, set `loginErrorEl.textContent = 'Account created — please login'` and `loginErrorEl.style.color = '#4ade80'` instead of setting these on `registerErrorEl`
- **Before** (lines ~3666-3669):
  ```js
  if (registerErrorEl) {
    registerErrorEl.textContent = 'Account created — please login';
    registerErrorEl.style.color = '#4ade80';
  }
  showLoginForm();
  ```
- **After**:
  ```js
  showLoginForm();
  if (loginErrorEl) {
    loginErrorEl.textContent = 'Account created — please login';
    loginErrorEl.style.color = '#4ade80';
  }
  ```

## Verification: code
