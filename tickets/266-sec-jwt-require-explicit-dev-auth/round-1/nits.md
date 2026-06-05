## Document ALLOW_DEV_AUTH in CONTEXT.md

`CONTEXT.md` still tells developers to run `pnpm run dev` with no auth env vars. After this ticket, local dev requires either `JWT_SECRET` or `ALLOW_DEV_AUTH=1`. The doc should state that explicitly so new contributors are not surprised by the startup throw.

### Acceptance Criteria

- `CONTEXT.md` "How to Run" section mentions that `pnpm run dev` sets or requires `ALLOW_DEV_AUTH=1` (or a `JWT_SECRET`) for local development.
- Example command or env note matches the error message in `game/server/auth.js`.
