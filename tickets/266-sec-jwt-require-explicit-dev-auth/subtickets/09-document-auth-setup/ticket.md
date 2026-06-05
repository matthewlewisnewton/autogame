# 09 — Document ALLOW_DEV_AUTH requirement in game/docs/

`CONTEXT.md` mentions `pnpm run dev` with no explanation of the `ALLOW_DEV_AUTH` opt-in. The previous attempt (07) targeted `CONTEXT.md` directly, which is outside the implementer's `game/**` scope and was reverted by scope_audit every iteration. Create an in-scope auth-setup doc under `game/docs/` that explains the requirement.

## Acceptance Criteria

- A new file `game/docs/auth-setup.md` exists and explains:
  - Local development requires either `JWT_SECRET` or `ALLOW_DEV_AUTH=1`.
  - The dev script (`pnpm run dev`) sets `ALLOW_DEV_AUTH=1` automatically (via `game/server/package.json`).
  - Production deployments must set `JWT_SECRET` to a cryptographically random value.
  - The error message developers see when neither is set.
- The doc wording aligns with the error message in `game/server/auth.js` ("set `JWT_SECRET` to a cryptographically random value" / "do not use this in production").

## Technical Specs

- Create `game/docs/auth-setup.md` with 1–2 short paragraphs covering the points above.
- Do not modify any game code or other files.

## Verification: code
