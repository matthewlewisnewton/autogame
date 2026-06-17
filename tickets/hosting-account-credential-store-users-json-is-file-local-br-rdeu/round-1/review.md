# Senior Review — Hosting: account/credential store migrated to shared storage

## Runtime health (gate)

- `metrics.json`: `"ok": true`, servers started, `pageerrors: []`, no `harness_failure`.
- `console.log`: clean except `[A:error]`/`[B:error] Failed to load resource: ... 409 (Conflict)`.
  This is a benign HTTP artifact of the deterministic auth capture re-registering an
  already-existing account (register returns 409 by design) — not a page error and not a
  fatal in game code. Scene initializes, both clients reach the squad lobby, enter
  gameplay, move (W/D), and the dodge-roll cooldown HUD probes correctly (`keyItemCooldownRemaining`
  401 → 0). The game starts and loads cleanly.

The game runs. Gate passes.

## Acceptance criteria

> With PERSISTENCE_BACKEND=postgres, the users store persists to Postgres: register against
> one instance, then log in via a SECOND instance pointed at the same DB succeeds;
> cosmetics/quest-unlock mutations persist via the provider; file + in-memory backends
> unchanged for default/test; existing auth/users tests pass; pg-mem used in tests.

**Users store persists to Postgres — MET.** `migrations/003_users.sql` adds a `users` table
(`username` PK, `account_id` UNIQUE NOT NULL, `data` JSONB, `updated_at`).
`PostgresProvider` implements `loadAllUsers/loadUser/saveUser/deleteUser` with an upsert keyed
on `username` (`ON CONFLICT (username) DO UPDATE`). `ensureUsersSchema` is idempotent and is
invoked at startup via `PostgresProvider.create()` (index.js:1894).

**Register on instance A, login on instance B — MET.** `users.js` now delegates to the provider:
`loadUsersAsync` hydrates the in-memory cache from `loadAllUsers`, `createUserAsync`/`persistUserAsync`
write through `saveUser`, and `findUserByUsernameAsync` falls back to `provider.loadUser` on a cache
miss and hydrates. `auth.js` login switched from `findUserByUsername` → `findUserByUsernameAsync`, so
a second cold instance resolves an account it never cached. `users_postgres_provider.test.js`
("register on instance A, login on instance B via shared Postgres") proves this against a shared
pg-mem pool, and asserts no `users.json` file is written.

**Cosmetics / quest-unlock mutations persist via provider — MET.** `updateProfile`, `unlockHat`,
`unlockQuestTier`, `completeQuestTier` are async and call `persistUserAsync` (and `deleteUser` on a
username change). Cross-instance tests confirm a cosmetic update and a tier-2 unlock on A are visible
on a freshly-booted B after hydration.

**File + in-memory backends unchanged for default/test — MET.** When no provider is wired,
`loadUsersAsync`/`persistUserAsync` fall back to the original `loadUsers()/saveUsers()` filesystem
path. `setTestFilePath` resets `_usersProvider = null`, preserving file-mode test semantics. Default
startup is still `FileProvider`; `NODE_ENV=test` defaults to `InMemoryProvider`. `users.test.js`
(31 file-backed tests) passes unchanged in behavior.

**Existing tests pass + pg-mem — MET.** Full server suite: **305 files, 4322 tests passing**. The new
and migrated tests (`users_postgres_provider`, `postgres_provider`, `players_schema`) use pg-mem; no
live DB required.

**No deasync / async base — MET.** `users.js` requires only `fs`/`bcrypt`/`crypto` — no `deasync`,
no `createUserAsync`/deasync deadlock. The migration is built on the async provider as the
Verification note required.

## Consistency / integration

The async mutation conversion was propagated correctly through the live call graph:
`cleanupAfterDamage` → `checkRunTerminalState` → `unlockQuestTier`/`completeQuestTier` are all async;
`cardEffects.handleUseCard`/`executeUseCard`/`resolvePendingCardUse`/`applyAstralShieldCast` were
made async and awaited; HTTP routes (`account.js` profile patch) and socket handlers
(`lobbyHandlers` hat unlock / appearance, `runHandlers` use-card / loot crystal) await their
mutations; `simulation.processPendingCardWindups` batches windup resolutions via `Promise.all`.

`checkRunTerminalState` was restructured so the only awaited work (quest-tier persistence) runs
*after* the `RUN_COMPLETE`/`RUN_FAILED` emit, using a captured `run` reference (and
`buildRunSummary(status, run)` / `grantRunRewards(playerId, {status, run})`) so an async provider
write cannot yield and swap lobby context before rewards are granted. This is a thoughtful concurrency
fix and the e2e victory tests (`citadel_capstone_e2e`, `rift_convergence_e2e`) were updated to await
the now-async terminal check.

Path-traversal defense is extended to user keys via `assertSafeStorageKey` on `username`/`accountId`
in all three providers. No regression to `game/docs/requirements.md` foundation.

No new debug scenario was added; existing scenarios were only made async (their `completeQuestTier`/
`unlockQuestTier` calls now awaited), so they continue to go through the same provider-backed
persistence — no invariant bypass.

## Remaining gaps

None blocking. See `nits.md` for non-blocking follow-ups (fire-and-forget rejection handling on the
unawaited `checkRunTerminalState()`/`cleanupAfterDamage()` production call sites).

VERDICT: PASS
