# Cleanup nits from 334-anim-deck-sifter

> **Staleness note.** This follow-up ticket was written against commit
> `267780a9` (2026-06-08). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `334-anim-deck-sifter`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove duplicate CARD_DEFS import in renderer test

`game/client/test/cardRenderers.test.js` imports `CARD_DEFS` from `../cards.js` twice (lines 2 and 9). ESM dedups the binding so the suite passes today, but the redundant import is confusing and a hazard for future edits.

### Acceptance Criteria
- `game/client/test/cardRenderers.test.js` imports `CARD_DEFS` exactly once.
- `npx vitest run client/test/cardRenderers.test.js` still passes.
