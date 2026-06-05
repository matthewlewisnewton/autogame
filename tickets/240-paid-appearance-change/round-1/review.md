## Per-Criterion Findings

### Runtime health
PASS. The captured run loaded and played cleanly. `metrics.json` reports `"ok": true`, `pageerrors` is empty, and the server/client logs show successful startup, lobby join, ready transition, movement, and dodge-roll gameplay. Console noise is limited to benign resource conflict lines plus Vite/WebGL-style development noise; there are no `pageerror` or `[fatal]` game-code failures.

### Appearance changes deduct gold atomically
PASS. Paid appearance fields are detected by the shared `hasAppearanceFieldChanges` helper, with hats explicitly excluded. The `applyAppearanceChange` socket handler validates the proposed cosmetic, charges currency through `chargeAppearanceChangeForPlayer`, persists player currency before calling `updateProfile`, and only then applies/syncs the account cosmetic. Failure paths cover insufficient funds, failed currency save, and account update failure without leaving an applied-but-free cosmetic.

### Price in config
PASS. The appearance fee is configured as `APPEARANCE_CHANGE_COST` on both server and client config paths and is used by the server charge helper and client confirm/cost label.

### Client confirm dialog
PASS. The character booth shows a paid-save confirmation only when body/color/model/proportion appearance fields differ from the saved account cosmetic. Hat-only changes skip the paid confirmation and remain free. Connected booth saves emit `applyAppearanceChange` instead of the legacy profile PATCH path, and socket errors re-enable the save UI with a visible message.

### Tests, insufficient funds, and crash safety
PASS. The new server tests cover successful paid charge, insufficient funds, hat-only free changes, profile-route blocking for live lobby appearance edits, persistence ordering, currency-save failure, and simulated crash/update failure cases. Client tests cover the confirmation flow, socket emission, error recovery, cost label, and hat-only behavior. The recorded coverage run passed: 91 test files, 1569 tests.

### Design and requirements consistency
PASS. The implementation fits the existing lobby/economy loop in `game/docs/design.md`: booth appearance edits use persistent account cosmetics and currency without disturbing dungeon combat, lobby flow, WebSocket connectivity, or movement synchronization. The smoke capture confirms no regression to the foundational requirements.

### Debug scenarios
PASS. This ticket did not add or change any `?debugScenario=` shortcut. The capture used normal auth/lobby/ready/gameplay flow.

## Remaining gaps

None.

VERDICT: PASS
