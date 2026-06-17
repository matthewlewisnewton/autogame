# Hosting: account/credential store (users.json) is file-local — breaks multi-instance login

## Difficulty: hard

## Goal

For horizontal-scale hosting on Fly, all auth state must live in shared storage so any instance can authenticate any account. But game/server/users.js persists the ENTIRE users store — username, bcrypt passwordHash, accountId, cosmetics, quest unlocks — to a file-local game/data/users.json via fs.readFileSync/writeFileSync (loadUsers/saveUsers + per-user mutations), with NO connection to the StorageProvider/Postgres (verified: users.js requires only fs + bcrypt; no provider/pool/DATABASE_URL). The eowb migration moved player+settings blobs to Postgres but left the credential store on local disk. Consequence on multi-instance: an account registered (or password/cosmetics/unlocks changed) on machine A does not exist in machine B's users.json, so login (password check) and account reads fail when a request lands on a different instance. JWT verification is stateless (fine), but register/login read+write the file-local store. FIX: migrate the users store to shared storage behind the provider abstraction (Postgres when PERSISTENCE_BACKEND=postgres + DATABASE_URL), mirroring the players/settings migration: a users table keyed by username + accountId, loadUsers/saveUsers and the per-user mutations going through the provider; keep file/in-memory backends for default/test; tests use pg-mem (no live DB). Found by the real-PG+Redis playthrough QA: gameplay blobs persisted to Postgres correctly, but credentials did not.

## Acceptance Criteria

- With PERSISTENCE_BACKEND=postgres, the users store persists to Postgres: register against one provider instance, then log in via a SECOND instance pointed at the same DB succeeds; cosmetics/quest-unlock mutations persist via the provider; file + in-memory backends unchanged for default/test; existing auth/users tests pass; pg-mem used in tests (no live DB required).

## Verification

BLOCKED on the deasync->async conversion (autogame-3qd3). Once that merges, REDO this users-migration on the async base: users.js delegates to the now-async provider with await (no deasync, no createUserAsync/deasync deadlock). The prior deasync-based attempts are void.
