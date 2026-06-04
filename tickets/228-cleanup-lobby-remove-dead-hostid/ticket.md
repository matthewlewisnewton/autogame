# Cleanup nits from 216-lobby-remove-dead-hostid

> **Staleness note.** This follow-up ticket was written against commit
> `f5d5ef9` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `216-lobby-remove-dead-hostid`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Flaky MS regen assertions in combat/loot tests

Several server tests use exact `expect(...magicStones).toBe(...)` after short sleeps; passive MS regen can tick fractional amounts between assertion and snapshot, causing intermittent failures (e.g. `30.005` vs `30` in `integration.test.js`, `field_medic_kit.test.js` “dead players skipped” at line ~201, `loot_magnet.test.js` cooldown timing). Ticket 216 only fixed one `field_medic_kit` case with `toBeCloseTo`; the pattern remains elsewhere.

### Acceptance Criteria
- Replace exact MS equality with `toBeCloseTo(..., 2)` (or equivalent) in the known-flaky tests listed above.
- `pnpm test:quick` passes reliably across three consecutive runs without changing game logic.
