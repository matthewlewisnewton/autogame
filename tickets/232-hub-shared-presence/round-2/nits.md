## Quiet Hub Presence Render Test Model Loading

The new client hub presence render test passes, but the coverage log includes stderr from the renderer trying to load `/models/player.glb` under the test environment. Mocking or disabling registry model loading in this focused render test would keep future QA logs easier to scan.

### Acceptance Criteria
- `client/test/hub-presence-render.test.js` still verifies remote hub avatar render/removal without emitting model-loading errors to stderr.
