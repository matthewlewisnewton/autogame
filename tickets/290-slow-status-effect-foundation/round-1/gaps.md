1. Local client prediction ignores SLOW, so a slowed local player still renders full-speed movement and then rubber-bands against the slower server-authoritative position.
   Files: `game/client/renderer.js`, `game/client/main.js`
   Fix: multiply the local prediction step by the active player's `slowFactor` whenever `Date.now() < slowedUntil`, and keep the local slow indicator aligned with the slowed avatar position.
