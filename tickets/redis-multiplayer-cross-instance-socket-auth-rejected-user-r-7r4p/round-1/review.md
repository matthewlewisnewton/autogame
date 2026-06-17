# Senior Review — cross-instance socket auth (lazy-load on cache miss)

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `capturePlanSource: "fallback"`, `pageerrors: []`, no `harness_failure` block. Servers started; full smoke flow (auth → lobby → ready → movement → dodge w/ cooldown) captured cleanly across two browser instances.
- `console.log`: only expected HTTP `401`/`409` resource responses from the auth/register flow (cross-instance register conflict + pre-auth probe). No `pageerror`, no `[fatal]`, no uncaught exception from game code.
- Probes confirm a connected, playing session (`connectionState: "connected"`, `sceneInitialized: true`, dodge cooldown HUD `keyItemCooldownRemaining: 421` then `0`).
- Full vitest suite: **2072 passed / 142 files** (coverage.log). Targeted re-run of touched files: **132 passed**.

Game runs and loads cleanly → gate passes.

## Acceptance criteria

The ticket is a P1 repro: a user registered on instance A is rejected when its
A-issued session cookie is used to open a socket on instance B
(`CONNECT_ERROR 'Session account not found'`), because the `io.use()` auth
middleware calls the in-memory-only `findUserByAccountId`, which never lazy-loads
from shared Postgres on a miss. Expected: the socket authenticates on either
instance.

**Root cause addressed — PASS.** The middleware at `game/server/index.js:1960`
now calls `await findUserByAccountIdAsync(session.accountId)`.
`findUserByAccountIdAsync` (`users.js:377`) returns the cached record on hit;
on miss, if a provider exposes `loadUserByAccountId`, it loads the record,
runs it through `hydrateRecord` (backfills + inserts into the `users` map and
both `accountIdIndex`/`emailIndex`), and returns it. This is exactly the
ticket's stated FIX DIRECTION.

**Provider support — PASS.** `loadUserByAccountId(accountId)` is implemented on
`InMemoryProvider`, `FileProvider`, and `PostgresProvider` (`providers.js`), each
guarded by `assertSafeStorageKey` and returning a deep-cloned record (Postgres
uses `SELECT data FROM users WHERE account_id = $1`). The base `StorageProvider`
(`storage.js`) declares the contract with a `Not implemented` stub. The async
finder defends against providers lacking the method (`typeof ... === 'function'`).

**Cross-instance repro proven — PASS.** `websocket_session_auth.test.js` adds a
test that wires two `PostgresProvider`s over one shared `pg-mem` pool and a
shared Redis shim, registers a user + creates a session on "A", switches the
provider and clears in-memory caches (`clearUserCaches`) to simulate cold
instance "B", then connects a socket with the A-issued cookie and asserts the
`init` event arrives with the right `accountId` — i.e. the old failure path
(`CONNECT_ERROR Session account not found`) is now a successful authenticated
connect via lazy-load. `users.test.js` covers the four branches of
`findUserByAccountIdAsync` (cache hit, no-provider miss, provider-load+hydrate,
provider-returns-null).

## Integration check
- Second sync caller `findUserByAccountId` at `index.js:1148`
  (`buildPlayerRecord`) is left synchronous. This is correct: it runs inside the
  `connection` handler, which fires only after the `io.use()` middleware has
  already lazy-loaded and hydrated that accountId into `accountIdIndex`, so the
  sync lookup hits the now-warm cache. No second cross-instance gap.
- `clearUserCaches` clears only the in-memory maps and intentionally leaves
  `_usersProvider` intact — appropriate for simulating a cold-but-wired instance.

## Design / regression
- Consistent with the multi-instance auth design (shared Redis sessions + shared
  Postgres user store). No change to session validation, persistence, or
  net-replication. No debug-scenario shortcuts were added or touched. No
  foundation regression — full suite green.

## Remaining gaps
None blocking. One minor robustness nit (sync lookup at `index.js:1148` relies on
middleware ordering) is recorded in `nits.md`.

VERDICT: PASS
