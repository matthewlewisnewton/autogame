1. `healing_font` and `divine_grace` still share the exact same visual renderer, so not every shipped spell has a distinct per-card cast/impact animation.
   Files: `game/client/cardRenderers.js`, `game/client/test/cardRenderers.test.js`
   Fix: Split `renderHealRestore` into distinct renderers for Restoration Beacon and Sanctum Pulse, give each a different helper/palette/signature, register them separately, and add tests proving the two call signatures differ.
