# Cleanup nits from 156-docs-design-md-stale-fixes

> **Staleness note.** This follow-up ticket was written against commit
> `a950850` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `156-docs-design-md-stale-fixes`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Playtesting example still uses legacy Mana Leach name

The `### Playtesting Notes` line was updated for Signal Familiar but still says **Mana Leach** while `CARD_DEFS.mana_leach.name` is **Ether Siphon** in `game/server/progression.js` and `game/client/cards.js`. A one-word example fix in the same parenthetical would complete naming accuracy for that bullet.

### Acceptance Criteria

- `game/docs/design.md` playtesting example uses **Ether Siphon** (or cites `mana_leach` with the live display name from `CARD_DEFS`).
- No other sections of `design.md` are reworded.
