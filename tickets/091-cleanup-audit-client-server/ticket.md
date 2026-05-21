# Cleanup nits from 020-audit-client-server

> **Staleness note.** This follow-up ticket was written against commit
> `4eec2b8` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `020-audit-client-server`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Avoid Transient Local Card Redraw Drift
After a server `stateUpdate` reconciles the local hand, the local `cardUsed` handler for summons still consumes the local slot and draws from the client-side deck. The next server tick corrects this, so it is not blocking, but relying solely on the authoritative hand update would avoid brief UI flicker or confusing local-only replacement cards.

### Acceptance Criteria
- Local summon confirmation does not call client-side `drawCard()` after the server has already emitted the authoritative hand state.
- Card slot visuals still update correctly from `stateUpdate` and `cardUsed` effects.

## Reduce Expected Collision-Rejection Log Spam
Holding movement into a wall can emit repeated swept-collision warnings in the server log during normal play. This is useful while debugging validation, but expected player input should not flood warning logs.

### Acceptance Criteria
- Repeated swept-collision movement rejections are throttled, downgraded to debug-level logging, or otherwise kept from spamming normal server logs.
- Invalid/malformed movement payloads still produce useful diagnostics.
