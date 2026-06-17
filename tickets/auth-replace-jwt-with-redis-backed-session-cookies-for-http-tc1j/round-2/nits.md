## Make session writes atomic against a real Redis

`createSession` issues `hset` then a separate `expire`, and `refreshSession`/`getSession` do
`hget`/`hgetall` then `hset` then `expire` as distinct round trips. Against a real Redis a
crash or disconnect between the `hset` and the `expire` would leave a session hash with **no
TTL** (it would persist forever instead of expiring after 24h). The in-memory shim and
ioredis-mock don't expose this, but production Redis would. Wrapping each pair in a
`multi()`/pipeline (or using `HSET` with per-field then a single `EXPIRE` in one transaction)
removes the window.

### Acceptance Criteria
- `createSession` sets the hash and its TTL atomically (single pipeline/multi round trip).
- `refreshSession` and `getSession`'s sliding-window update set `lastSeen` and `expire`
  atomically.
- Existing sessions tests still pass.

## Add a production `Secure` cookie attribute test

`cookies.test.js` / `auth.test.js` assert the non-production attributes (`HttpOnly`,
`SameSite=Lax`, no `Secure`). There is no test asserting that `Secure` IS appended when
`NODE_ENV === 'production'`. A small test would lock in the prod-vs-dev branch so a future
refactor of `sessionCookieAttributes()` can't silently drop `Secure` in production.

### Acceptance Criteria
- A test sets `NODE_ENV=production` and asserts the Set-Cookie value contains `Secure`.
- A test asserts `Secure` is absent when `NODE_ENV` is not production.