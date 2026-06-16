# Cleanup nits from hosting-serve-the-built-client-same-origin-from-the-node-ser-2arv

> **Staleness note.** This follow-up ticket was written against commit
> `805a4624` (2026-06-15). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `hosting-serve-the-built-client-same-origin-from-the-node-ser-2arv`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Static-serve test recursively deletes game/client/dist on teardown

`game/server/test/hosting-static-serve.test.js` creates a mock `game/client/dist`
in `beforeAll` and `fs.rmSync(mockDist, { recursive: true, force: true })` in
`afterAll`. `dist/` is gitignored so nothing tracked is at risk, but a developer
who has a real local `pnpm build` output in `game/client/dist` would have it
silently wiped when running the server test suite. A safer pattern is to write
the mock into a temp dir and point the server at it, or to skip teardown when a
pre-existing (non-mock) `dist` was detected at setup.

### Acceptance Criteria
- Running the server test suite no longer deletes a pre-existing developer build
  in `game/client/dist` (either by using an isolated temp directory or by
  guarding teardown against a non-test-created dist).
- `hosting-static-serve.test.js` still verifies static serving + SPA fallback and
  passes.
