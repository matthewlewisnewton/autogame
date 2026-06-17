## Drop the now-unused `token` parameter from client `createSocket`

`game/client/main.js` `createSocket(token, options)` no longer uses `token` —
socket auth rides the session cookie. The parameter is kept "for backward
compatibility," but once all callers are confirmed migrated it is dead weight
and slightly misleading (suggests token-based auth is still wired). Worth a
follow-up cleanup to remove the parameter and update call sites.

### Acceptance Criteria
- `createSocket` signature no longer accepts an unused `token` argument (or it is
  documented as truly required by a remaining caller).
- All call sites updated; client socket tests still pass.

## Add an explicit cross-instance assertion to the socket-auth test

The current suite validates the in-memory shim path implicitly. A small test
that creates a session via one store handle and validates the socket connection
against a second server instance sharing the same store would make the
"works cross-instance (shared Redis)" claim explicit and regression-proof.

### Acceptance Criteria
- A test demonstrates a session created against the shared store authenticates a
  socket on a separately-started server instance.
