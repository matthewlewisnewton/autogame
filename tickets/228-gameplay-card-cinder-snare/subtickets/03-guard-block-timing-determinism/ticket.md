# Fix flaky guard_block timing assertions so the full Vitest suite is green

The two `guard_block` socket-integration tests assert that `remainingMs` and
`blockingUntil - Date.now()` are `toBeCloseTo` the configured cooldown/duration.
A few milliseconds elapse between the key-item use and the assertion, so under
full-suite load the measured values drift (e.g. 3495 vs 3500, 693 vs 700) and
fail the `-1` precision check. Make these assertions robust to that small,
expected real-time drift so the whole suite passes deterministically.

## Acceptance Criteria

- `cd game && pnpm test` (full suite with coverage) exits green — 0 failed tests.
- Running `npx vitest run server/test/guard_block.test.js` repeatedly (and as part
  of the full suite) no longer fails on the `remainingMs` / `blockingDuration`
  timing assertions.
- The two assertions still meaningfully bound the value: `remainingMs` must be
  `> 0` and `<= def.cooldownMs` (allowing only for elapsed time, i.e. within a
  small tolerance below `cooldownMs`); `blockingDuration` must be `> 0` and
  `<= def.durationMs` within the same small tolerance.
- No change to the guard_block runtime behavior (cooldownMs / durationMs values in
  `keyItemEffects.js` are unchanged); the fix is in how the tests assert, not in
  weakening the feature.

## Technical Specs

- `game/server/test/guard_block.test.js`:
  - `cooldown enforced` test (~line 358): replace
    `expect(result2.remainingMs).toBeCloseTo(def.cooldownMs, -1)` with bounds that
    tolerate elapsed time, e.g. assert `result2.remainingMs > 0`,
    `result2.remainingMs <= def.cooldownMs`, and
    `result2.remainingMs >= def.cooldownMs - 250` (a margin comfortably larger than
    realistic inter-call drift but far smaller than `cooldownMs`).
  - `blockingUntil expires` test (~line 377): replace
    `expect(blockingDuration).toBeCloseTo(def.durationMs, -1)` with the analogous
    bounds against `def.durationMs` (`> 0`, `<= def.durationMs`,
    `>= def.durationMs - 250`).
- Do NOT modify `game/server/keyItemEffects.js` definitions; only adjust the test
  assertions to be drift-tolerant. (Inspect `keyItemEffects.js` only to confirm
  `cooldownMs`/`durationMs` are the source values.)

## Verification: code
