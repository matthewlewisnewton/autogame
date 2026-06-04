## Remove Hardcoded Card Count From Acquisition Test

`game/server/test/card_acquisition.test.js` currently asserts that both card definition maps have exactly 42 keys. The key-parity assertion already catches sync drift, so the fixed count will create unnecessary test churn when a future ticket intentionally adds or removes a card.

### Acceptance Criteria
- The acquisition coverage test verifies server/shared card definition parity without hardcoding the current total card count.
