# Hosting: make StorageProvider async and remove deasync (perf + unblocks users migration)

## Difficulty: hard

## Goal

deasync (game/server/providers.js: runSync -> deasync.loopWhile) makes PostgresProvider's methods synchronous by BUSY-SPINNING the Node event loop at 100% CPU until each pg query resolves. This is (1) a serious perf/scalability liability — every player/settings save blocks the ENTIRE process spinning at 100% CPU on a network round-trip, serializing all I/O under load (directly fights the horizontal-scale hosting goal); and (2) the root cause of deadlocks when these sync methods are called from async contexts or test-runner callbacks (it hung the users migration autogame-rdeu and the e2e tests). REPLACE deasync with a properly async storage layer. Specifically: PostgresProvider methods become async with plain 'await this.pool.query(...)' (drop runSync/deasync entirely; remove the deasync dependency from game/server/package.json and the deasync entry from pnpm-workspace.yaml allowBuilds); FileProvider and InMemoryProvider methods become async too (wrap their existing sync bodies — trivial) so the StorageProvider interface is uniformly async. Then update the 5 sync call sites to await: admin.js:38 (loadPlayer), index.js:1306 (loadPlayer), progression.js:995 (savePlayer), settings.js:425 (loadSettings), settings.js:471 (saveSettings) — and propagate async/await UP through their immediate synchronous wrappers/callers so nothing calls an async provider method without awaiting (a forgotten await returns a Promise instead of data). Scope verified: deasync is used ONLY in providers.js; only those 5 call sites consume the sync persistence API, all at discrete events (login/save/settings), NOT the hot game tick. With deasync gone, providers test normally in vitest (no deadlock); use pg-mem for Postgres tests.

## Acceptance Criteria

- deasync removed entirely (no require('deasync'); not in package.json deps nor pnpm-workspace.yaml allowBuilds); all StorageProvider methods (Postgres/File/InMemory) are async returning Promises; every call site awaits them (no un-awaited provider call leaks a raw Promise); player save/load + settings save/load + admin load work end-to-end via existing+updated tests using pg-mem (no live DB, no 100% CPU busy-spin); existing server test suite passes.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
