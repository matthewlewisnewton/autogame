## Flaky MS regen assertions in combat/loot tests

Several server tests use exact `expect(...magicStones).toBe(...)` after short sleeps; passive MS regen can tick fractional amounts between assertion and snapshot, causing intermittent failures (e.g. `30.005` vs `30` in `integration.test.js`, `field_medic_kit.test.js` “dead players skipped” at line ~201, `loot_magnet.test.js` cooldown timing). Ticket 216 only fixed one `field_medic_kit` case with `toBeCloseTo`; the pattern remains elsewhere.

### Acceptance Criteria
- Replace exact MS equality with `toBeCloseTo(..., 2)` (or equivalent) in the known-flaky tests listed above.
- `pnpm test:quick` passes reliably across three consecutive runs without changing game logic.
