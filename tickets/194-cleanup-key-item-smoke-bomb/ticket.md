# Cleanup nits from 128-key-item-smoke-bomb

> **Staleness note.** This follow-up ticket was written against commit
> `b62bac1` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `128-key-item-smoke-bomb`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Deduplicate the smoke duration constant between client and server

The client `SMOKE_DURATION = 2000` in `game/client/renderer.js` is a hard-coded
copy of the server's `KEY_ITEM_DEFS.smoke_bomb.durationMs`. If the server zone
duration is ever retuned, the VFX length will silently drift out of sync. Drive
the VFX fade from the server-provided `smokeBombUntil` (already replicated) or a
shared constant instead of a local literal.

### Acceptance Criteria
- The client smoke puff lifetime is derived from server state / a shared source
  rather than a duplicated `2000` literal, so retuning `durationMs` keeps the
  VFX in sync with no client edit.
