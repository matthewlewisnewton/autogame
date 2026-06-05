## Silence Hub Lobby Renderer Test Stderr

`client/test/hub-lobby-render.test.js` passes, but the coverage log includes renderer stderr because the test environment cannot parse the absolute model URL `/models/player.glb`. This does not affect gameplay or assertions, but it makes the test output noisier than necessary and can hide real warnings later.

### Acceptance Criteria
- The hub lobby renderer test still verifies local avatar creation in the hub.
- Running the coverage suite no longer prints the `/models/player.glb` URL parse warning from this test.
