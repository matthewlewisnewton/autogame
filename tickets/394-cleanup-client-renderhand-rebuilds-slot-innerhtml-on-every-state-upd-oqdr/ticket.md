# Cleanup nits from client-renderhand-rebuilds-slot-innerhtml-on-every-state-upd-oqdr

> **Staleness note.** This follow-up ticket was written against commit
> `a83b952b` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `client-renderhand-rebuilds-slot-innerhtml-on-every-state-upd-oqdr`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Consolidate duplicate renderHand skip tests

`game/client/test/main.test.js` now has two nearly identical tests — `'skips innerHTML rebuild when slot signature is unchanged'` and `'skips DOM rebuild when slot signature is unchanged'` — that assert the same behavior via slightly different checks (`innerHTML` equality vs `childNodes.length`). Keeping one well-named test reduces maintenance noise.

### Acceptance Criteria
- Only one test remains that verifies `renderHand()` skips per-slot DOM rebuild when the signature is unchanged
- The surviving test asserts both stable `innerHTML` and stable child-node count (or uses an innerHTML spy)
- All `renderHand()` tests still pass

## Remove or strengthen weak charge-pct skip test

`'always updates --charge-pct even when slot signature matches'` only exercises the first `renderHand()` call and does not mutate state between calls. The stronger `'still updates --charge-pct on consecutive calls with same card'` already covers the skip-path charge animation. The weaker test adds noise without unique coverage.

### Acceptance Criteria
- Either delete `'always updates --charge-pct even when slot signature matches'` or extend it to perform a second `renderHand()` with mutated minion TTL and assert `--charge-pct` changed
- No duplicate assertion of the same scenario as the consecutive-calls test
