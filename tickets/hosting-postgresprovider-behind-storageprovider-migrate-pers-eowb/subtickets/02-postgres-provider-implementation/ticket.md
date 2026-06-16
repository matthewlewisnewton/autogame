# PostgresProvider class

Implement `PostgresProvider` in `game/server/providers.js`, extending the existing synchronous `StorageProvider` interface. The class persists player blobs to the `players` table from sub-ticket 01, reusing `assertSafePlayerId` for defense-in-depth. Do not change `StorageProvider`, `FileProvider`, or `InMemoryProvider`.

## Acceptance Criteria

- `PostgresProvider` extends `StorageProvider` and is exported from `game/server/providers.js`.
- Constructor accepts a Postgres connection string (`DATABASE_URL`) and optionally an injectable `pg.Pool` for tests; on construction it calls `ensurePlayersSchema` from sub-ticket 01.
- `savePlayer(playerId, data)` calls `assertSafePlayerId(playerId)`, deep-copies `data` (same semantics as `InMemoryProvider`), and UPSERTs into `players` (`player_id`, `data`).
- `loadPlayer(playerId)` calls `assertSafePlayerId(playerId)`, returns `null` when no row exists, otherwise returns a deep-copied parsed JSON object.
- `close()` ends the pool without throwing (may be a no-op if pool already ended).
- Sync interface is preserved: blocking `pool.query` is acceptable (minimal sync bridge over async `pg` if needed); do **not** change method signatures on `StorageProvider`.
- `FileProvider` and `InMemoryProvider` code paths are untouched.

## Technical Specs

- **`game/server/providers.js`**
  - Import `Pool` from `pg`, `ensurePlayersSchema` from `game/server/db/ensurePlayersSchema.js`, and existing `assertSafePlayerId`.
  - Add `class PostgresProvider extends StorageProvider` with `savePlayer`, `loadPlayer`, `close`.
  - UPSERT SQL example: `INSERT INTO players (player_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (player_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()` (adjust if `updated_at` omitted).
  - SELECT: `SELECT data FROM players WHERE player_id = $1`.
  - Export `PostgresProvider` alongside existing providers.
- **`game/server/db/ensurePlayersSchema.js`** — consumed at provider init; no changes required unless constructor needs a tweaked API.
- **Sync/async note:** callers (`savePlayerData` in `progression.js`) invoke `savePlayer`/`loadPlayer` synchronously today; wrap async `pg` queries with a small in-file sync waiter (e.g. flag + `deasync` loop or equivalent) rather than changing the interface.

## Verification: code
