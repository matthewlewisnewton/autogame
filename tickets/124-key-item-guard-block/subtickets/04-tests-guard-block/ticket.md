# 04 — Tests: Guard block damage reduction & cooldown

Add integration tests to verify guard block reduces frontal damage, allows rear chip damage, expires after duration, and enforces cooldown.

## Acceptance Criteria

- Test: **frontal hit is reduced** — player activates guard_block, enemy attacks from within 150° frontal arc, damage received is ~30% of original (70% reduction)
- Test: **rear hit is full damage** — player activates guard_block, enemy attacks from behind (outside 150° arc), damage received is 100%
- Test: **expires after duration** — after `blockingUntil` passes, subsequent hits deal full damage regardless of angle
- Test: **cooldown enforced** — second `useKeyItem` for `guard_block` within cooldown window returns `on_cooldown`
- Test: **dodge i-frames take priority** — if `invulnerableUntil` is set, damage is fully blocked (null) regardless of `blockingUntil` being active

## Technical Specs

- **server/test/guard_block.test.js** (new file): Create test file using the same harness as `dodge_roll.test.js` and `key-items.test.js`:
  - Use `startTestServer()`, `connectClient()`, `waitForEvent()`, `playerForSocket()`, `testGameState()`
  - Helper: `connectAndStartRun()` to get into playing phase
  - Helper: position enemy at specific angles relative to player's facing direction to test frontal vs rear
  - Use `damagePlayer()` directly from simulation for unit-level angle tests, or use socket flow + `debugScenario` for integration tests
  - Mirror the structure of existing `dodge_roll.test.js` tests (direction, wall collision, invulnerability)
- Tests should cover:
  1. `guard_block` sets `blockingUntil` and `blockingYaw` on the player
  2. Frontal attack (0° offset): `damagePlayer` reduces damage by 70%
  3. Edge of arc (75° offset, i.e. half of 150°): still reduced
  4. Rear attack (180° offset): full damage
  5. After `blockingUntil` expires: full damage from any angle
  6. Cooldown: second use within 3500ms returns `on_cooldown`
  7. `invulnerableUntil` + `blockingUntil` both set: damage is `null` (dodge wins)

## Verification: code
