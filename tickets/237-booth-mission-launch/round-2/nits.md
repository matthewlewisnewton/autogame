## Add End-To-End Coverage For Launch Booth Flow
The current ticket has good helper-level tests and the live code path is straightforward, but the main `boothAction` listener wiring is not directly exercised in an end-to-end client/server test. A focused smoke or integration test would make future booth refactors safer by proving a real Launch Bay interaction emits `playerReady` and reaches `startGame`.

### Acceptance Criteria
- Add a test that exercises the Launch Bay booth interaction path from an in-range hub player through server `boothAction` and client ready-up behavior.
- Verify the test still uses the normal `playerReady`/`checkAllReady` route rather than introducing a separate launch-only socket path.
