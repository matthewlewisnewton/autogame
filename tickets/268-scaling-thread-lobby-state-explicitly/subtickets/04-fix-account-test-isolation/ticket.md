# Fix flaky account.test.js registration failure (test isolation)

The top-level acceptance criterion "tests green" is failing intermittently: under
the full coverage run (`cd game && pnpm test`), `server/test/account.test.js >
GET /api/me > returns profile and default settings` gets HTTP 500 from
`/api/register` instead of 201. The state-threading code changes (sub-tickets
01–03) are behaviourally correct; this is a pre-existing test-isolation flake
that must be eliminated so the suite is reliably green.

## Root cause (confirmed)

`game/server/test/account.test.js:85` builds its temp user-file path as
`account-test-users-${Date.now()}.json` — it is the ONLY filesystem-touching
server test that omits the per-call random suffix that every sibling uses
(`auth.test.js`, `cosmetic.test.js`, `cosmetic_runtime.test.js`, and
`users.test.js` all use `${Date.now()}-${Math.random().toString(36).slice(2)}`).
A millisecond-resolution timestamp is not unique enough across the parallel
coverage run (`fileParallelism: true`, `maxWorkers: 4`) and across the many
`beforeEach` invocations in this file, so two runs can land on the same
`usersFilePath`. When one test's `afterEach` `unlinkSync`s the shared file while
another `createUserAsync` → `saveUsers` is mid-write, `fs.renameSync(tmp,
usersFilePath)` throws, the `/register` route's `catch` returns 500, and the
assertion `expect(regRes.status).toBe(201)` fails.

## Acceptance Criteria

- `cd game && pnpm test` completes with zero failing tests (the full coverage
  run, which is what QA runs), including
  `server/test/account.test.js > GET /api/me > returns profile and default settings`.
- The temp user-file path used by `account.test.js` is unique per invocation
  (e.g. carries a random/pid component, or is created via `fs.mkdtempSync`), so
  it cannot collide across parallel workers or rapid successive `beforeEach`
  calls — matching the pattern already used by the sibling test files.
- No production/runtime behaviour changes: the fix is confined to test setup
  (and, if needed, defensive hardening of the persistence helper). The
  `/api/register` happy path still returns 201 and the GET /api/me assertions
  remain unchanged.
- No new flake is introduced: running `cd game && pnpm test:quick` twice in a
  row is green both times.

## Technical Specs

- `game/server/test/account.test.js`: change the `tmpUserFile` construction in
  `beforeEach` (currently line ~85, `path.join(os.tmpdir(),
  `account-test-users-${Date.now()}.json`)`) to be collision-proof — append
  `-${process.pid}-${Math.random().toString(36).slice(2)}` (mirroring
  `auth.test.js:75` / `cosmetic.test.js:384`), or derive the file inside a
  `fs.mkdtempSync`-created directory. Keep the existing `afterEach` cleanup
  consistent with whatever path scheme is chosen.
- Optionally, if reproduction shows `saveUsers` still races, harden
  `game/server/users.js` `saveUsers()` (lines ~62–70) so the `mkdirSync` /
  `writeFileSync` / `renameSync` atomic-write sequence cannot throw an
  unhandled error during a concurrent unlink (e.g. ensure the parent dir exists
  immediately before the rename). Do this ONLY if the test-path fix alone does
  not make `pnpm test` reliably green; prefer the minimal test-only change.
- Do NOT modify any sub-ticket folder containing a `.passed` marker, and do not
  alter the progression/state-threading changes from sub-tickets 01–03.
- Reproduce before and after with the actual failing command (`cd game &&
  pnpm test`), since the flake only surfaces under the parallel coverage run,
  not when the file runs alone.

## Verification: code
