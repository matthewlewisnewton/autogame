# persistence: cross-instance profile data-loss — stale user cache on instance B clobbers profile changes made on A

## Difficulty: medium

## Goal

REPRO (real Postgres+Redis, two instances A:3220 / B:3221, shared DATABASE_URL + REDIS_URL, PERSISTENCE_BACKEND=postgres):

PRECONDITION: account is cached in BOTH instances' in-memory user maps (e.g. it existed at each instance's boot, or was HTTP-logged-in on each — login hydrates via findUserByUsernameAsync provider fallback). No concurrency required.

1. Instance A: PATCH /api/me/profile {"email":"survive@example.com"} -> 200. Postgres users.data->>'email' = 'survive@example.com' (verified via psql).
2. Instance B: PATCH /api/me/profile {"cosmetic":{"bodyColor":"#ff0000"}} (a DIFFERENT field) -> 200.
3. Postgres users.data->>'email' is now CLOBBERED back to B's stale cached value (the email from before step 1) — A's email change is SILENTLY LOST. Verified: after B's cosmetic-only write, DB email reverted from 'survive@example.com' to the older 'bside@example.com'.

ROOT CAUSE: server/users.js keeps a write-through in-memory cache (users Map + accountIdIndex/emailIndex) that is populated at boot (loadUsersAsync) / on createUserAsync / on findUserByUsernameAsync cache-miss, but is NEVER refreshed or invalidated afterward. updateProfile (server/users.js) mutates the cached record in place and persists the WHOLE record via persistUserAsync -> provider.saveUser, which does an UPSERT of the entire JSONB blob. So instance B writes its stale full record, overwriting any fields another instance changed in Postgres since B last loaded that record. GET /api/me + requireAuth + the socket io.use() middleware all read this stale cache via findUserByAccountId, so reads are also stale (B's /api/me returned email:null while DB had crosstest@example.com).

EXPECTED: profile reads reflect current Postgres state; a field write on one instance does not clobber unrelated fields persisted by another instance.
ACTUAL: per-instance stale cache -> stale reads AND last-writer-wins-on-the-whole-blob lost updates across instances.

SCOPE: User/profile store ONLY. Settings store (server/settings.js getSettings/updateSettings) reads Postgres fresh per request (no cache) and was verified cross-instance coherent (sequential cross-instance writes of different keys both survived). Player store persists under accountId and survived restart correctly.

RELATED: autogame-7r4p (P1, in_progress) covers the adjacent socket-auth-rejected-on-B path (A-issued cookie used directly on B with no prior HTTP login on B -> findUserByAccountId misses -> 'Session account not found'). THIS bead is the data-loss/stale-read consequence of the same root cause (no provider-backed read path for the user record) and persists even when auth succeeds. A fix that makes the user store read-through/write-without-full-blob-clobber (or drops the cache for profile reads, like settings does) should resolve both.

FIX DIRECTION (not applied; READ-ONLY QA): make findUserByAccountId / the profile read+write path go through the provider (read-modify-write against Postgres like settings.js), or invalidate the cache on a cross-instance signal. Do NOT persist the whole stale cached blob on a partial update.

EVIDENCE (psql): docker exec autogame-e2e-postgres psql -U autogame -d autogame_e2e -c "SELECT data->>'email' FROM users WHERE username='persistqa_1bd2b8d0'" — flips to stale value after the cross-instance cosmetic-only write.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
