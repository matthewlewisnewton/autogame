## Add unit tests for the hat-unlock server flow
The new unlock logic — `unlockHatForPlayer` (progression.js), `unlockHat`
(users.js), and the `unlockHat` socket handler (index.js) — has no dedicated
unit/integration test. The schema changes are well covered, but the
currency-deduction, dedupe/persist, refund-on-failure, and error-emission paths
are only exercised indirectly. Adding tests would lock in the validation and
the currency/`unlockedHats` consistency guard against future regressions.
### Acceptance Criteria
- A test asserts `unlockHatForPlayer` rejects an unknown hat and an unaffordable
  hat without mutating `player.currency`, and on success deducts exactly the
  catalog price.
- A test asserts `users.unlockHat` validates the catalog id, dedupes, persists
  via `saveUsers`, and is idempotent for an already-owned hat.
- A test exercises the `unlockHat` socket handler end-to-end: success emits
  `hatUnlocked` with updated `unlockedHats` + `currency`; an already-owned hat
  and an unaffordable hat emit `hatError` with no state change.
