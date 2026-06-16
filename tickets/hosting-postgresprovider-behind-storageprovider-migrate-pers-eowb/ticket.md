# Hosting: PostgresProvider behind StorageProvider (migrate persistence off flat files)

## Difficulty: hard

## Goal

Multi-instance hosting (Fly.io horizontal scale) requires shared persistence so any server instance can auth and load any player; the current FileProvider writes one JSON file per account on local disk, which is single-instance only. Add a PostgresProvider implementing the existing StorageProvider interface in game/server/providers.js (all StorageProvider methods incl. savePlayer/loadPlayer), backed by a players table keyed by the safe accountId/playerId. Add a schema/migration (SQL or a small migrate script). Select the backend via env: PERSISTENCE_BACKEND=postgres + DATABASE_URL (default stays FileProvider; NODE_ENV=test keeps InMemoryProvider). Use the pg driver. CRITICAL: tests must NOT require a live database — use pg-mem (in-memory Postgres) or equivalent so unit tests run in CI. Do not change the StorageProvider interface or break FileProvider/InMemoryProvider. Keep the existing path-traversal accountId guards (assertSafePlayerId).

## Acceptance Criteria

- PostgresProvider implements StorageProvider; round-trips savePlayer/loadPlayer via pg-mem in tests; PERSISTENCE_BACKEND=postgres selects it and DATABASE_URL is honored; FileProvider and InMemoryProvider unchanged with passing tests; full suite runs with no live DB.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
