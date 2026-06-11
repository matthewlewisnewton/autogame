# Cleanup nits from auth-register-flips-to-login-form-without-prefilling-usernam-aogf

> **Staleness note.** This follow-up ticket was written against commit
> `9a402984` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `auth-register-flips-to-login-form-without-prefilling-usernam-aogf`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Reset login error color after register success

The register-success path sets `#login-error` to green (`#4ade80`) but the login failure handler only updates `textContent`, never resets `style.color`. If the player mistypes their password after registering, the error message may still render in green.

### Acceptance Criteria
- After a failed login attempt, `#login-error` uses the same color as other auth error messages (not the register-success green).
- Register success still shows the green `Account created — please login` message before the first login attempt.
