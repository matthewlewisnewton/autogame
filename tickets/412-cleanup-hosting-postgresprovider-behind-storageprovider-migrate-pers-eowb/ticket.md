# Cleanup nits from hosting-postgresprovider-behind-storageprovider-migrate-pers-eowb

> **Staleness note.** This follow-up ticket was written against commit
> `b74137ec` (2026-06-16). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `hosting-postgresprovider-behind-storageprovider-migrate-pers-eowb`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## PostgresProvider blocks the event loop via deasync

`PostgresProvider` uses `deasync.loopWhile` (`runSync` in `game/server/providers.js`) to make async `pg` queries satisfy the synchronous `StorageProvider` interface. This blocks the entire Node.js event loop — including all other players' socket.io traffic — for the full duration of each DB round-trip. For the multi-instance hosting / horizontal-scale goal that motivated this ticket, that serialization could become a throughput bottleneck under load, and `deasync` is a native addon that complicates builds (it also can't run inside vitest workers, forcing the child-process test harness). Worth revisiting if/when the `StorageProvider` interface can be made async (an async interface would also benefit FileProvider's sync fs calls).

### Acceptance Criteria
- Evaluate making `StorageProvider.savePlayer`/`loadPlayer`/`close` async (returning Promises) across all three providers and their call sites in `server/index.js`.
- If adopted, remove the `deasync` dependency and the child-process pg-mem test runner, running the pg-mem round-trip tests directly in vitest.
- Full server + client suites still pass with no live DB.

## ensurePlayersSchema has no dedicated unit test

`game/server/db/ensurePlayersSchema.js` is exercised indirectly (the pgmem tests use `skipSchemaEnsure: true` and apply the SQL manually), so the idempotent `information_schema` existence check and the apply-on-empty path are not directly covered.

### Acceptance Criteria
- Add a pg-mem test that calls `ensurePlayersSchema` twice against a fresh db and asserts the `players` table exists and the second call is a no-op (does not throw).
