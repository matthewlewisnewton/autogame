# Cleanup nits from 131-key-item-purge-charm

> **Staleness note.** This follow-up ticket was written against commit
> `548bd4f` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `131-key-item-purge-charm`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Align Purge Charm Description With Behavior

The `purge_charm` key item description still says "Remove all negative effects", but the ticketed and implemented behavior removes only the oldest active debuff or grants a one-hit shield when there are none. Updating the player-facing description will prevent confusion when multiple debuffs are present.

### Acceptance Criteria
- `purge_charm` description text clearly says it removes one debuff, or grants a one-hit shield if no debuff is present.
- Any key item UI using the description reflects the corrected behavior without changing the server mechanic.
