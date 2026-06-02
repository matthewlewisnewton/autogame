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
