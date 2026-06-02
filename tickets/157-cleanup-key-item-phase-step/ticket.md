# Cleanup nits from 130-key-item-phase-step

> **Staleness note.** This follow-up ticket was written against commit
> `cacd685` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `130-key-item-phase-step`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Share Phase Step Range With The Client Highlight

`game/client/renderer.js` hard-codes `PHASE_STEP_RANGE = 6` to match `KEY_ITEM_DEFS.phase_step.range`. The server remains authoritative, so this is not a gameplay blocker, but future balance tuning could make the highlight disagree with the actual usable range.

### Acceptance Criteria
- Phase Step ally highlighting reads its range from key-item definition data or another shared source instead of a duplicated client constant.
