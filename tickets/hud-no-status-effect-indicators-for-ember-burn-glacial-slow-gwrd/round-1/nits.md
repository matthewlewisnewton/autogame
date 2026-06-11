## Add a DOM-level test for updateStatusEffectStrip

`computeActiveStatusEffects` is unit-tested, but the rendering wiring in
`updateStatusEffectStrip` (`game/client/main.js`) — badge creation, the
`.has-effects` show/hide toggle, and the `"<label> <Ns>"` text — has no direct
coverage. A jsdom test would lock in the visible behaviour the AC cares about.

### Acceptance Criteria
- A client test renders the strip with an active burn and an active slow and
  asserts two `.status-badge` elements with the expected icons/labels and the
  `has-effects` class present.
- The same test asserts the strip empties and loses `has-effects` once both
  effects have expired (e.g. by advancing the `now` used for the snapshot).

## Capture a live burning/slowed HUD state

The fallback smoke capture never puts the player into a burning or slowed state,
so no screenshot demonstrates the badge actually on screen. A capture scenario
that walks the player into ember/glacial hazard (or uses the existing burn debug
scenario) would give visual proof for future regressions.

### Acceptance Criteria
- A capture screenshot shows at least one `#status-effect-strip` badge visible
  (Burning and/or Slowed) during gameplay.
