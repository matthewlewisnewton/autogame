# Senior Review — persistence: cross-instance profile data-loss (stale user cache clobber)

## Runtime health (blocking gate)
- `metrics.json`: `"ok": true`, URL served, `pageerrors: []`, no `harness_failure`.
- `console.log`: only benign noise — Vite connect logs, an expected pre-auth
  401, a 409 (lobby name conflict from the two-player smoke), and a WS-closed
  warning on socket teardown. No `pageerror`/`[fatal]` lines from game code.
- Full-flow smoke captured cleanly: auth → lobby create/join → ready → movement
  (W/D) → dodge roll with cooldown HUD (`keyItemCooldownRemaining: 431`,
  `keyItemIndicatorText: "0.4"`), scene initialized, latency 1ms.

The game starts and loads cleanly. Runtime gate passes.

## Acceptance criteria

The ticket frames acceptance as the REPRO/EXPECTED contract: (1) profile reads
reflect current Postgres state, and (2) a field write on one instance must not
clobber unrelated fields persisted by another instance.

### AC1 — a partial profile write on stale instance B does not clobber A's field
**Met.** `updateProfile` (game/server/users.js:406) now begins with
`await findUserByAccountIdAsync(accountId)`, which (when a provider is wired)
reloads the authoritative record from storage via the new
`loadUserByAccountId`, runs backfills, and `hydrateRecord` *replaces* the stale
cache entry (`users.set` + `indexUser` → `accountIdIndex.set`). The subsequent
in-place mutation and `persistUserAsync` therefore write the fresh record + the
one changed field, not a stale full blob. Verified by the test
`updateProfile on stale instance B does not clobber email written on A`
(users_postgres_provider.test.js:160): B holds a stale cache with the old
email, A writes `survive@example.com`, B then does a cosmetic-only write, and
the DB still has `survive@example.com` AND the new `bodyColor` — exactly the
ticket's repro, now passing.

### AC2 — profile reads reflect current Postgres state
**Met.** All in-scope read paths now go through `findUserByAccountIdAsync`,
which reloads + re-indexes from the provider:
- `GET /api/me` (account.js:51)
- `requireAuth` middleware (account.js:35)
- socket `io.use()` auth middleware (index.js:1960) — also fixes the related
  "Session account not found" / stale-read path noted in the ticket.
Verified by `stale instance B GET /api/me profile shape reflects email updated
on A` and `findUserByAccountIdAsync refreshes stale cross-instance cache ...`.

### AC3 — provider read primitive added across all backends
**Met.** `loadUserByAccountId` implemented on `InMemoryProvider`,
`FileProvider`, and `PostgresProvider` (providers.js), declared on the
`StorageProvider` base (storage.js), each applying `assertSafeStorageKey` like
the sibling `loadUser`. Postgres queries `WHERE account_id = $1`.

### AC4 — verification harness (vitest server+client)
**Met.** Ran the affected suites locally:
- `users_postgres_provider.test.js` + `postgres_provider.test.js` → 40 passed.
- `account.test.js` + `users.test.js` → 47 passed.
No regressions.

## Design / foundation consistency
Consistent with the settings.js read-through pattern the ticket points to. The
sync `findUserByAccountId` remains for downstream display-only lookups
(buildPlayerRecord index.js:1148, lobbyHandlers), but these run *after* the
async auth middleware has already primed the cache for that account at
connection time, so they read coherent data and never persist — no clobber
risk. The sync read at account.js:96 is only a live-lobby appearance-change
guard; the authoritative write still flows through async `updateProfile`.

## Debug scenarios
None added or changed by this ticket. N/A.

## Code quality
Clean. Well-documented helpers, defensive provider fallback when no provider is
configured (preserves dev/test sync semantics), and a clearly-marked
`cacheUserRecordForTest` internal helper used only to seed stale-cache states in
tests.

## Remaining gaps
None blocking. One adjacent follow-up (non-blocking) captured in nits.md:
`unlockHat` / `unlockQuestTier` still read the sync stale cache before a
whole-blob `persistUserAsync`, so they retain the same theoretical
cross-instance clobber shape — outside this ticket's profile-store scope and not
exercised by the repro, but worth hardening later.

VERDICT: PASS
