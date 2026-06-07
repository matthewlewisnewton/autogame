## Remove Stale Lobby-Visibility Warnings From Walkable Hub Capture

The ticket-305 screenshot fallback succeeds, but `screenshot.log` still records timeout warnings from generic `createLobby` and `joinLobby` actions waiting for `#lobby` to become visible. After the post-304 hub flow, the correct success state is the hidden lobby menu plus active hub canvas, so these warnings are noisy and can make future capture logs look suspicious even when the probe passes.

### Acceptance Criteria
- The walkable-hub fallback capture uses the post-304 hub-ready condition for lobby creation/join waits and no longer emits timeout warnings for the expected hidden `#lobby` state.
