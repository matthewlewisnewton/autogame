# Senior Review — Hosting: route settings persistence through the storage provider

## Runtime health (blocking gate)

The captured run is clean:
- `metrics.json` → `"ok": true`, `pageerrors: []`, no `harness_failure` block, servers started (URL reachable).
- `console.log` → no `pageerror` / `[fatal]` lines from game code.
- Probes show a full normal flow: auth → squad lobby → ready → gameplay → movement → dodge with cooldown HUD. Player state, enemies, deck, and HUD all render correctly.

The game starts and loads cleanly. Runtime gate **passes**.

Note: this is a backend/hosting persistence ticket; the capture exercises gameplay (which depends on the storage layer being intact) and confirms nothing regressed. The settings-persistence behavior itself is verified by the unit/pg-mem suites below.

## Acceptance criterion

**AC: Settings read/write go through the provider; with `PERSISTENCE_BACKEND=postgres` they persist to Postgres (verified via pg-mem); file/in-memory modes unchanged; existing settings tests pass.**

Met. Findings:

- **Provider interface** (`game/server/storage.js`): `saveSettings`/`loadSettings` added to the `StorageProvider` base as `Not implemented` contract methods, mirroring the player methods.

- **All three providers implement it** (`game/server/providers.js`):
  - `InMemoryProvider` — deep-copy in/out via a dedicated `settingsStore` Map (isolated from player store).
  - `FileProvider` — atomic write (tmp + `renameSync`, tmp cleanup on error) into a `settings/` subdir, `ENOENT → null` on read. Same location as the legacy settings dir (`{dataPath}/settings/{accountId}.json`) and same pretty-printed JSON, so file behavior is preserved.
  - `PostgresProvider` — `INSERT ... ON CONFLICT (account_id) DO UPDATE` upsert into a `settings` table, `SELECT` returning `null` when absent. JSONB column.
  - All three call `assertSafePlayerId(accountId)` (regex `/^[A-Za-z0-9_-]+$/`), preserving the existing accountId sanitization.

- **Schema** (`game/server/migrations/002_settings.sql`, `game/server/db/ensurePlayersSchema.js`): new `settings` table (account_id PK, JSONB data, updated_at). `ensureSettingsSchema` is idempotent (information_schema guard) and run from `PostgresProvider` construction alongside `ensurePlayersSchema`.

- **Routing** (`game/server/settings.js`): `getSettings`/`updateSettings` delegate to the provider when one is set, falling back to the original file path otherwise. The accountId guard is applied identically in both branches. `mergeWithDefaults(null)` is safe (`backfillSettings` treats non-objects as `{}` and returns defaults), so a provider miss yields defaults — equivalent to the file-mode ENOENT path. The oversize-on-read fallback to defaults is preserved in the provider branch. `initSettingsPath` resets the provider back to file mode, keeping existing file-based tests intact.

- **Startup wiring** (`game/server/index.js`): after the provider is constructed, `initSettingsWithProvider(getProvider())` routes all settings I/O through the active backend (File/InMemory/Postgres) — so production always goes through the provider, matching the AC.

- **pg-mem verification** (`game/server/test/postgres_provider.pgmem.cjs` + `.test.js`): round-trip, unknown-account null, overwrite/upsert, cross-account isolation, independence from player data, path-traversal rejection on save and load, and UUID-shaped accountIds — all driven through `PostgresProvider` against pg-mem.

- **File/in-memory parity tests** (`game/server/test/providers.test.js`): equivalent settings coverage for `InMemoryProvider` and `FileProvider` (store/retrieve, null-on-missing, overwrite, isolation, subdir placement).

- **Test run**: `vitest run` on providers, postgres_provider, settings, players_schema, persistence → **142/142 pass**, including the pre-existing settings suite (file mode unchanged).

## Code quality

- Consistent with existing player-persistence patterns; sanitization reused, not reinvented.
- Atomic file write with collision-resistant tmp name and cleanup.
- No dead code, no console errors, no regressions observed in the capture.

## Remaining gaps

None blocking. (One nit recorded in `nits.md`: the provider-routing branches inside `settings.js` itself are not covered by a module-level integration test — the provider methods are tested directly, but `getSettings`/`updateSettings` delegating to a provider is verified only by inspection and startup wiring.)

VERDICT: PASS
