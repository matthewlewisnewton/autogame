# redis/multiplayer: cross-instance socket auth rejected — user registered on A is invisible on B (Session account not found)

## Difficulty: medium

## Goal

REPRO (real Redis + Postgres, two instances machine-A:3230 / machine-B:3231, shared REDIS_URL + DATABASE_URL):
1. POST /api/register on instance A -> 201, sets ag_session cookie. Session is written to shared Redis (session:<token> hash with accountId).
2. Connect socket.io to A with that cookie -> CONNECTED (works).
3. Connect socket.io to B with the SAME A-issued cookie -> CONNECT_ERROR 'Session account not found'.

EXPECTED: session cookie is validated against shared Redis (sessions.getSession works cross-instance), so the socket should authenticate on either instance.
ACTUAL: B rejects. The io.use() auth middleware in server/index.js (~line 1960) calls findUserByAccountId(session.accountId), but server/users.js keeps a purely in-memory accountIdIndex populated only at startup (loadUsersAsync/loadAllUsers) and on local createUserAsync. A user account created on A after B started is NOT in B's in-memory index, and there is no lazy load-from-Postgres-on-miss. getSession (Redis) succeeds, but findUserByAccountId returns null -> next(new Error('Session account not found')).

IMPACT: P1 cross-instance-broken. Fly LB routes a fresh client (no lobby yet) to an arbitrary instance; if it differs from the one the account was created on, the socket is permanently rejected until that instance restarts and reloads all users. Defeats the multi-instance auth design. Also affects login-on-A-then-served-by-B.

EVIDENCE:
- session keys present in Redis: docker exec autogame-e2e-redis redis-cli keys 'session:*'
- driver: game/tmp/mpqa/xinstance.cjs output:
    A-issued cookie -> A: CONNECTED
    A-issued cookie -> B (cross-instance): CONNECT_ERROR Session account not found
- B.log shows the connection attempt then immediate disconnect; A.log shows successful connect.

FIX DIRECTION (not applied): findUserByAccountId should fall back to the storage provider (Postgres loadUser/loadAllUsers) on cache miss, or the auth middleware should hydrate the account from Postgres when the in-memory index misses. READ-ONLY QA; not fixed.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
