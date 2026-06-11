## Reset login error color after register success

The register-success path sets `#login-error` to green (`#4ade80`) but the login failure handler only updates `textContent`, never resets `style.color`. If the player mistypes their password after registering, the error message may still render in green.

### Acceptance Criteria
- After a failed login attempt, `#login-error` uses the same color as other auth error messages (not the register-success green).
- Register success still shows the green `Account created — please login` message before the first login attempt.
