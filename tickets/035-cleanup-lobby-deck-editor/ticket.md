# Cleanup nits from 028-lobby-deck-editor

> **Staleness note.** This follow-up ticket was written against commit
> `1798436` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `028-lobby-deck-editor`.
None blocked acceptance — clean them up when convenient.

## Fix broken integration test `deckAddCard during playing phase is silently ignored`

The test in `game/server/test/integration.test.js` builds a timeout sentinel
with `new Promise((_, r) => setTimeout(() => r('timeout'), 500))` — `r` is the
*reject* callback, so when the expected silence occurs the promise rejects and
the `await Promise.race(...)` throws before `expect(result).toBe('timeout')` is
reached. The suite shows a red test even though the server's lobby-only guard
is correct (the sibling `deckRemoveCard` test, which uses `sleep`, passes).

### Acceptance Criteria
- The timeout sentinel resolves (not rejects) with `'timeout'`, or the test is
  rewritten to use `sleep`/`once` like the `deckRemoveCard` sibling test.
- `npx vitest run` reports the full suite green.

## Decide the default selected-deck size

New players get a default `selectedDeck` of the 4 unique starting card ids
(`[...new Set(STARTING_DECK_IDS)]`), not the full 8-card `createStartingDeck()`.
A 4-card deck deals all 4 into the opening hand and leaves nothing in the draw
deck, so exhausted weapon slots never refill mid-run. Confirm this is intended;
if not, seed the default from the full starting deck (8 cards, still ≤ max 12).

### Acceptance Criteria
- The default selected deck is intentionally chosen and documented (comment in
  `game/server/index.js` near `defaultDeck`).
- If a draw-deck reserve is desired, the default is the full 8-card starting
  deck and remains valid against owned counts.
