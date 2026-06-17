# Update CONTEXT.md auth wording (session cookies)

Repo-root `CONTEXT.md` still tells developers that Socket.IO requires a JWT from `/api/register` or `/api/login`. Replace that line with session-cookie wording. Depends on sub-ticket 05 (harness `extra_safe_paths` for `CONTEXT.md`).

## Acceptance Criteria

- `CONTEXT.md` line under "How to Run" no longer says socket connections require a JWT; it states that auth uses httpOnly session cookies (`ag_session`) for both REST and Socket.IO.
- The replacement text is equivalent to: "Register or log in via the auth overlay before playing. Auth uses httpOnly session cookies (`ag_session`) for both REST and Socket.IO."
- No other lines in `CONTEXT.md` are modified.
- `rg -i 'JWT_SECRET|jsonwebtoken|verifyToken|ALLOW_DEV_AUTH' CONTEXT.md` returns no matches.

## Technical Specs

- **File to change:** `CONTEXT.md` (repo root)
- Replace "Socket connections require a JWT from `/api/register` or `/api/login`." with session-cookie wording as above.
- Single-line documentation fix only; do not modify game code or harness files.

## Verification: code
