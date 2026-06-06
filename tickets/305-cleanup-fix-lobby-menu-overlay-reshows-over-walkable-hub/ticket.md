# Cleanup nits from 304-fix-lobby-menu-overlay-reshows-over-walkable-hub

> **Staleness note.** This follow-up ticket was written against commit
> `932a7157` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `304-fix-lobby-menu-overlay-reshows-over-walkable-hub`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Preserve booth debug auto-open after hub entry dismissal

The localhost-only `?booth=quest`, `?booth=deck`, and `?booth=shop` shortcuts can open their booth UI during hub entry and then be hidden again by the unconditional lobby-menu dismissal at the end of `applyLobbyJoinedData()`. Normal booth interaction still works, so this is a QA-shortcut cleanup rather than a ticket blocker.

### Acceptance Criteria
- Loading the hub with `?booth=quest`, `?booth=deck`, or `?booth=shop` on localhost leaves the requested booth UI visible after `applyLobbyJoinedData()` completes.
- The automatic hub-entry dismissal still hides the large lobby menu when no `?booth=` shortcut is present.
