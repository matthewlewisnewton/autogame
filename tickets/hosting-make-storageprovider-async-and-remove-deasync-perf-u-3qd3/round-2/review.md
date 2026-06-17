# Senior Review — Make StorageProvider async and remove deasync

## Runtime health (gate)

The captured run is clean and the game loads:

- `round-2/metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block.
  Full smoke flow captured (auth → lobby create/join → ready → movement → dodge
  with cooldown HUD); probes show `connectionState: connected`,
  `sceneInitialized: true`, gameplay phase, HP/cooldown updating correctly.
- `round-2/console.log`: no `pageerror`/`[fatal]` lines. The only `error` line is
  a single `409 (Conflict)` on a lobby-create resource — the known benign
  concurrent-auth/lobby race, not a code defect. Vite connect lines are benign.

Runtime gate: **PASS**.

## Per-criterion findings

### deasync removed entirely
PASS. `require('deasync')` and the `runSync`/`deasync.loopWhile` bridge are gone
from `game/server/providers.js`. Removed from `game/server/package.json`
dependencies and from `pnpm-workspace.yaml` `allowBuilds`. Stale references also
cleaned from the `Dockerfile` builder comment and `scripts/run-e2e.sh` header.
A source grep (`grep -rn deasync game/`) returns only unrelated `node_modules`
shim artifacts — no source reference remains.

### All StorageProvider methods async
PASS. The base `StorageProvider` (`storage.js`) and all three backends
(`InMemoryProvider`, `FileProvider`, `PostgresProvider` in `providers.js`) now
declare `async savePlayer/loadPlayer/saveSettings/loadSettings/close`. Postgres
methods use plain `await this.pool.query(...)`. Schema bootstrap (which
previously ran via `runSync` in the constructor) is now an awaitable
`static async create(databaseUrl, options)` factory, used at startup.

### Every call site awaits — no raw-Promise leak
PASS. The five named call sites and their callers were made async and propagated
upward:
- `index.js`: `loadSavedPlayerData`, `joinPlayerToLobby`,
  `joinLobbyWithPhasePolicy`, the `io.on('connection', async …)` handler, and
  `startServer` are async; `PostgresProvider.create(...)` is awaited at startup.
- `admin.js`: `buildAdminRoster`/`adminHandler` async; per-account
  `loadPlayer` awaited via `Promise.all`.
- `progression.js`: `savePlayerData`/`saveAllPlayers`/`returnPlayersToLobby`
  async and awaited where the result matters.
- `settings.js`: `getSettings`/`updateSettings` async; `account.js` `/me` routes
  awaited.
- Socket handlers updated: hat-unlock and appearance-change await `savePlayerData`
  on the exploit-sensitive currency-then-commit path; background/best-effort saves
  use `void savePlayerData(...)`.

`withLobbyContext` was correctly upgraded to detect a thenable return and defer
its context-restore (`popContext`) via `.finally()`, so the lobby `_gameState`
context stays bound across awaits inside async callbacks (and `withLobbyPlayer`/
`withLobbyFromSocket` both `return` it, so the promise propagates). Background
fire-and-forget saves (`void savePlayerData/saveAllPlayers`) are safe: the data
snapshot (`extractPersistentData`) and the query dispatch happen synchronously
before the first `await`, and `savePlayerData` catches and logs all errors
internally (returns `false`), so no unhandled rejection escapes. A targeted grep
for un-awaited provider calls returned nothing.

### Works end-to-end via pg-mem; existing suite passes
PASS (with one unrelated flake). `postgres_provider.test.js` uses `pg-mem`
(`newDb()`) — no live DB, no busy-spin. The persistence-focused suites
(providers, postgres_provider, persistence, settings, admin_roster, account)
pass 173/173 locally. The full suite in `coverage.log` shows **2416 passed /
2417**; the single failure is `training_caverns_spawn_camp.test.js` ("entry
aggro grace window"), a combat-AI/timing test that touches no persistence code,
was not modified by this ticket, and passes 3/3 when run in isolation — i.e. a
pre-existing order/timing flake, not a regression from this change.

### Consistency with design / no foundation regression
PASS. The change is a behind-the-interface persistence refactor; it does not
alter gameplay, netcode, or the design contract. Removing the 100%-CPU busy-spin
directly advances the stated hosting/horizontal-scale goal and unblocks the users
migration. The captured gameplay (movement, dodge cooldown, card hand, objective
state) is intact.

## Remaining gaps

None blocking. (A minor robustness nit on socket-handler rejection guarding is
recorded in `nits.md`.)

VERDICT: PASS
